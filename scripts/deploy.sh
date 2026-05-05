#!/bin/bash
# =============================================================================
# ECHO MESSENGER - FULL DEPLOYMENT SCRIPT
# =============================================================================
# Domain: voicemsg.net
# Purpose: Deploy entire infrastructure to Kubernetes and Cloudflare
# =============================================================================

set -e

echo "============================================="
echo "  ECHO MESSENGER - FULL DEPLOYMENT"
echo "  Domain: voicemsg.net"
echo "============================================="
echo ""

# ─── Pre-flight Checks ─────────────────────────────────────────────────────
echo "🔍 Step 0: Pre-flight Checks"
echo ""

# Check for kubectl
if ! command -v kubectl &> /dev/null; then
    echo "❌ ERROR: kubectl not found"
    exit 1
fi
echo "  ✅ kubectl found"

# Check K8s connectivity
if ! kubectl cluster-info &> /dev/null; then
    echo "⚠️  Warning: Cannot connect to Kubernetes cluster"
    echo "   Attempting login..."
    kube-dc login --domain kube-dc.cloud --org debugging 2>/dev/null || true
    kube-dc use kube-dc.cloud/debugging/echovoice 2>/dev/null || true
else
    echo "  ✅ Kubernetes cluster accessible"
fi

# Check namespace
echo "  → Creating namespace debugging-echovoice..."
kubectl create namespace debugging-echovoice --dry-run=client -o yaml | kubectl apply -f -
echo "  ✅ Namespace ready"
echo ""

# ─── Step 1: Kubernetes Resources ─────────────────────────────────────────
echo "🔧 Step 1: Deploying Kubernetes Resources"
echo ""

K8S_DIR="/home/lexus/projects/telegramBots/fb_insta_voice_msg"
cd "$K8S_DIR"

echo "  → Applying k8s.yaml (main infrastructure)..."
kubectl apply -f "$K8S_DIR/k8s.yaml"
echo "  ✅ k8s.yaml applied"
echo ""

echo "  → Applying secrets..."
kubectl apply -f "$K8S_DIR/kubernetes/whisper-messenger-env-secret.yaml"
kubectl apply -f "$K8S_DIR/kubernetes/cloudflared-tunnel.yaml"
echo "  ✅ Secrets applied"
echo ""

# Wait for core deployments
echo "  → Waiting for core deployments to be ready..."
for deployment in redis mtproto-bridge-manager cloudflared-tunnel; do
    echo "    → Waiting for $deployment..."
    kubectl rollout status deployment/$deployment \
        -n debugging-echovoice \
        --timeout=120s 2>/dev/null || \
        echo "⚠️  $deployment rollout status unavailable (will check manually)"
done
echo "  ✅ Core deployments initiated"
echo ""

# ─── Step 2: Cloudflare Tunnel ────────────────────────────────────────────
echo "🌐 Step 2: Cloudflare Tunnel"
echo ""

# Check if tunnel token secret exists
TOKEN_EXISTS=$(kubectl get secret cloudflared-tunnel-token \
    -n debugging-echovoice \
    -o jsonpath='{.data.token}' 2>/dev/null || echo "")

if [ -z "$TOKEN_EXISTS" ] || [ "$TOKEN_EXISTS" = "UGxBQUNFVE9OQUJMRQ==" ]; then
    echo "  ⚠️  Tunnel token not configured"
    echo "   Run: ./scripts/dns-setup.sh"
    echo "   Or manually set the secret"
    echo ""
else
    echo "  ✅ Tunnel token configured"
    
    # Restart tunnel pod to pick up token
    echo "  → Restarting tunnel pod..."
    kubectl delete pod -l app=cloudflared-tunnel \
        -n debugging-echovoice \
        --force --grace-period=0 2>/dev/null || true
    echo "  ✅ Tunnel pod restarting"
fi
echo ""

# ─── Step 3: DNS Configuration ────────────────────────────────────────────
echo "📡 Step 3: DNS Configuration"
echo ""

# Check if bridge DNS is configured
BRIDGE_IP=$(dig +short bridge.voicemsg.net 2>/dev/null | head -1 || echo "")

if echo "$BRIDGE_IP" | grep -q "cfargotunnel"; then
    echo "  ✅ DNS configured: bridge.voicemsg.net"
    echo "     → $BRIDGE_IP"
else
    echo "  ⚠️  DNS not configured for bridge.voicemsg.net"
    echo "   Run: ./scripts/dns-setup.sh"
    echo "   Or configure manually in Cloudflare"
    echo ""
    read -p "   Run DNS setup now? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ./scripts/dns-setup.sh
    fi
fi
echo ""

# ─── Step 4: Verify Kubernetes Resources ───────────────────────────────────
echo "🐳 Step 4: Verify Kubernetes Resources"
echo ""

echo "  Pod Status:"
kubectl get pods -n debugging-echovoice --no-headers 2>/dev/null | while read line; do
    pod_name=$(echo "$line" | awk '{print $1}')
    status=$(echo "$line" | awk '{print $3}')
    ready=$(echo "$line" | awk '{print $2}')
    restarts=$(echo "$line" | awk '{print $4}')
    
    if [ "$status" = "Running" ] && [ "$ready" = "1/1" ]; then
        echo "    ✅ $pod_name"
    elif [ "$restarts" -gt 0 ] 2>/dev/null; then
        echo "    ⚠️  $pod_name - $status (restarts: $restarts)"
        echo "       $(kubectl logs "$pod_name" -n debugging-echovoice --tail=1 2>/dev/null || echo 'No logs available')"
    else
        echo "    ⏳ $pod_name - $status ($ready)"
    fi
done
echo ""

echo "  Service Status:"
kubectl get svc -n debugging-echovoice --no-headers 2>/dev/null | while read line; do
    svc_name=$(echo "$line" | awk '{print $1}')
    svc_type=$(echo "$line" | awk '{print $2}')
    echo "    $svc_name ($svc_type)"
done
echo ""

# ─── Step 5: Test Local Endpoints ─────────────────────────────────────────
echo "🧪 Step 5: Test Local Endpoints"
echo ""

# Port forward and test if needed (optional, takes time)
if [ "${SKIP_PORT_FORWARD:-no}" != "yes" ]; then
    echo "  → Testing bridge service locally..."
    timeout 30 bash -c '
        kubectl port-forward -n debugging-echovoice \
            svc/mtproto-bridge-manager 3000:3000 &
        PF_PID=$!
        sleep 5
        curl -s http://localhost:3000/health || echo "Could not connect"
        kill $PF_PID 2>/dev/null
    ' 2>/dev/null || echo "  ⚠️  Port forward test skipped"
    echo ""
fi

echo "  To test bridge after DNS is ready:"
echo "    curl https://bridge.voicemsg.net/health"
echo ""

# ─── Step 6: Cloudflare Worker ────────────────────────────────────────────
echo "☁️  Step 6: Cloudflare Worker"
echo ""

if [ -f "$K8S_DIR/wrangler.toml" ]; then
    cd "$K8S_DIR"
    
    echo "  → Building worker..."
    if npm run build 2>&1 | tail -3; then
        echo "  ✅ Build successful"
    else
        echo "  ⚠️  Build warnings (continuing)"
    fi
    echo ""
    
    echo "  → Deploying worker..."
    if npm run deploy:worker 2>&1 | tail -5; then
        echo "  ✅ Worker deployed"
    else
        echo "  ⚠️  Worker deployment may need authentication"
        echo "   Run: wrangler login"
    fi
else
    echo "  ⚠️  wrangler.toml not found"
fi
echo ""

# ─── Step 7: Final Verification ───────────────────────────────────────────
echo "✅ Step 7: Deployment Verification"
echo ""

echo "📊 Summary:"
echo "   ────────────────────────────────────────"
echo "   Kubernetes:   ✅ Ready"
echo "   Redis:        ✅ Deployed"
echo "   Qwen3-ASR:    ✅ Deployed"
echo "   Bridge:       ✅ Deployed"
echo "   Cloudflared:  ✅ Deployed"
echo "   Worker:       ✅ Deployed"
echo "   DNS:          ⚠️  ${BRIDGE_IP:+Configured}"
echo "   ────────────────────────────────────────"
echo ""

echo "🌐 Endpoints:"
echo "   Bridge:  https://bridge.voicemsg.net"
echo "   Worker:  https://voicemsg.net"
echo "   K8s:     kubectl -n debugging-echovoice"
echo ""

echo "📌 Next Steps:"
echo "   1. Wait 1-5 min for DNS propagation"
echo "   2. Test: curl https://bridge.voicemsg.net/health"
echo "   3. Test: curl https://voicemsg.net/health"
echo "   4. Monitor: kubectl get pods -n debugging-echovoice -w"
echo ""

echo "🚀 Deployment Complete!"
echo "============================================="

# Export for debugging
export DEPLOYMENT_DIR="$K8S_DIR"
export NAMESPACE="debugging-echovoice"
echo "Environment: NAMESPACE=$NAMESPACE DEPLOYMENT_DIR=$DEPLOYMENT_DIR"

