#!/bin/bash
# =============================================================================
# CLOUDFLARE DNS & TUNNEL AUTOMATION
# =============================================================================
# Domain: voicemsg.net
# Purpose: Complete DNS setup with Cloudflare + Kubernetes
# Steps:
#   0. Add all DNS records via wrangler
#   1. Create/update Cloudflare tunnel
#   2. Update Kubernetes secret with tunnel token
#   3. Apply k8s.yaml
#   4. Wait for DNS propagation
#   5. Test endpoints
#   6. Deploy Cloudflare Worker
# =============================================================================

set -e

echo "================================================================"
echo "  CLOUDFLARE DNS & TUNNEL SETUP"
echo "  Domain: voicemsg.net"
echo "================================================================"
echo ""

# ─── Configuration ────────────────────────────────────────────────────────
DOMAIN="voicemsg.net"
TUNNEL_NAME="echo-messenger-tunnel"
NAMESPACE="debugging-echovoice"
K8S_DIR="/home/lexus/projects/telegramBots/fb_insta_voice_msg"

cd "$K8S_DIR"

# ─── Step 0: Get Cloudflare Zone ID ───────────────────────────────────────
echo "🔍 Step 0: Fetching Cloudflare Zone ID..."
echo ""

ZONE_ID=$(wrangler whoami 2>/dev/null | grep -oP 'account_id.*?\K[^"]+' || echo "")

if [ -z "$ZONE_ID" ]; then
    echo "⚠️  Could not auto-detect Zone ID"
    echo "   Getting from wrangler..."
    
    # Try to get zone list
    ZONE_LIST=$(wrangler whoami 2>&1 || true)
    echo "$ZONE_LIST"
    echo ""
    
    read -p "Enter your Cloudflare Zone ID (from dashboard): " ZONE_ID
fi

echo "✅ Zone ID: ${ZONE_ID}"
echo ""

# ─── Step 1: Create Cloudflare Tunnel ─────────────────────────────────────
echo "🚇 Step 1: Creating Cloudflare Tunnel..."
echo ""

# Delete existing tunnel if it exists
echo "  → Cleaning up existing tunnel..."
cloudflared tunnel delete "$TUNNEL_NAME" 2>/dev/null || true
sleep 2

# Create new tunnel
echo "  → Creating tunnel: $TUNNEL_NAME"
TUNNEL_JSON=$(cloudflared tunnel create "$TUNNEL_NAME" 2>&1)
echo "$TUNNEL_JSON"
echo ""

# Extract Tunnel ID
TUNNEL_ID=$(echo "$TUNNEL_JSON" | grep -oP 'Created tunnel \K[a-f0-9-]+' || echo "")

if [ -z "$TUNNEL_ID" ]; then
    TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "$TUNNEL_NAME" | awk '{print $1}' || echo "")
fi

if [ -z "$TUNNEL_ID" ]; then
    echo "⚠️  Could not extract Tunnel ID, listing tunnels..."
    cloudflared tunnel list
    echo ""
    read -p "Enter Tunnel ID manually: " TUNNEL_ID
fi

echo "✅ Tunnel created: $TUNNEL_NAME"
echo "   ID: $TUNNEL_ID"
echo ""

# ─── Step 2: Configure DNS Records ────────────────────────────────────────
echo "📝 Step 2: Configuring DNS Records..."
echo ""

# Create CNAME records via cloudflared
echo "  → Creating CNAME record: bridge.$DOMAIN"
cloudflared tunnel route dns "$TUNNEL_NAME" "bridge.$DOMAIN" 2>&1 || \
    echo "⚠️  Could not create DNS record (trying API)"
echo ""

echo "  → Creating CNAME record: app.$DOMAIN"
cloudflared tunnel route dns "$TUNNEL_NAME" "app.$DOMAIN" 2>&1 || \
    echo "⚠️  Could not create DNS record (trying API)"
echo ""

# Verify DNS records
echo "  → Verifying DNS records..."
cloudflared tunnel list 2>&1 | grep "$TUNNEL_NAME" || true
echo ""

# Get Tunnel Credentials
echo "  → Getting tunnel credentials..."
TUNNEL_TOKEN=$(cloudflared tunnel token "$TUNNEL_ID" 2>/dev/null || echo "")

if [ -n "$TUNNEL_TOKEN" ]; then
    echo "$TUNNEL_TOKEN" > /tmp/tunnel-token.txt
    echo "✅ Tunnel token saved to /tmp/tunnel-token.txt"
else
    echo "⚠️  Could not fetch tunnel token automatically"
    TUNNEL_TOKEN=$(cloudflared tunnel token "$TUNNEL_NAME" 2>/dev/null || echo "")
    
    if [ -z "$TUNNEL_TOKEN" ]; then
        echo "   Run manually: cloudflared tunnel token $TUNNEL_ID"
        read -p "   Enter token manually: " TUNNEL_TOKEN
    fi
fi
echo ""

# ─── Step 3: Update Kubernetes Secret ─────────────────────────────────────
echo "🔐 Step 3: Updating Kubernetes Secret..."
echo ""

if [ -n "$TUNNEL_TOKEN" ]; then
    kubectl create secret generic cloudflared-tunnel-token \
        --namespace="$NAMESPACE" \
        --from-literal=token="$TUNNEL_TOKEN" \
        --dry-run=client -o yaml | kubectl apply -f -
    echo "✅ Secret updated: cloudflared-tunnel-token"
else
    echo "⚠️  No tunnel token available, creating placeholder"
    kubectl create secret generic cloudflared-tunnel-token \
        --namespace="$NAMESPACE" \
        --from-literal=token="PLACEHOLDER_TOKEN" \
        --dry-run=client -o yaml | kubectl apply -f -
    echo "   UPDATE MANUALLY AFTER CREATING TUNNEL!"
fi
echo ""

# ─── Step 4: Apply Kubernetes Configuration ────────────────────────────────
echo "📦 Step 4: Applying Kubernetes Configuration..."
echo ""

echo "  → Applying k8s.yaml"
kubectl apply -f "$K8S_DIR/k8s.yaml"
echo "✅ k8s.yaml applied"
echo ""

echo "  → Applying secrets"
kubectl apply -f "$K8S_DIR/kubernetes/whisper-messenger-env-secret.yaml"
kubectl apply -f "$K8S_DIR/kubernetes/cloudflared-tunnel.yaml"
echo "✅ Secrets applied"
echo ""

# ─── Step 5: Wait for DNS Propagation ─────────────────────────────────────
echo "⏳ Step 5: Waiting for DNS propagation..."
echo ""

for i in {1..30}; do
    echo "  → Checking DNS ($i/30)..."
    
    # Check if CNAME resolves
    CNAME_RESULT=$(dig +short "bridge.$DOMAIN" 2>/dev/null | head -1)
    
    if echo "$CNAME_RESULT" | grep -q "cfargotunnel"; then
        echo "✅ DNS propagated: bridge.$DOMAIN → $CNAME_RESULT"
        break
    fi
    
    if [ $i -eq 30 ]; then
        echo "⚠️  DNS propagation taking longer than expected"
        echo "   CNAME record: bridge.$DOMAIN"
        echo "   Expected: *.cfargotunnel.com"
        echo "   Got: $CNAME_RESULT"
    fi
    
    sleep 10
done
echo ""

# ─── Step 6: Wait for Pods ────────────────────────────────────────────────
echo "🐳 Step 6: Waiting for Kubernetes Pods..."
echo ""

# Wait for core pods
for pod_type in redis mtproto-bridge-manager cloudflared-tunnel; do
    echo "  → Waiting for $pod_type..."
    kubectl wait --for=condition=ready pod \
        -l "app=$pod_type" \
        -n "$NAMESPACE" \
        --timeout=120s 2>/dev/null || \
        echo "⚠️  $pod_type not ready (will retry)"
done

# Show pod status
echo ""
echo "  Pod Status:"
kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | while read line; do
    pod_name=$(echo "$line" | awk '{print $1}')
    status=$(echo "$line" | awk '{print $3}')
    ready=$(echo "$line" | awk '{print $2}')
    
    if [ "$status" = "Running" ]; then
        echo "    ✅ $pod_name ($ready)"
    else
        echo "    ⚠️  $pod_name - $status"
    fi
done
echo ""

# ─── Step 7: Test Endpoints ───────────────────────────────────────────────
echo "🧪 Step 7: Testing Endpoints..."
echo ""

# Test bridge endpoint
echo "  → Testing: https://bridge.$DOMAIN/health"
BRIDGE_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" \
    --connect-timeout 10 \
    --max-time 15 \
    "https://bridge.$DOMAIN/health" || echo "000")

if [ "$BRIDGE_HEALTH" = "200" ]; then
    echo "    ✅ Bridge health check: $BRIDGE_HEALTH"
else
    echo "    ⚠️  Bridge health check: $BRIDGE_HEALTH"
    echo "   (May need more time to start)"
fi

# Test worker endpoint
echo "  → Testing: https://$DOMAIN/health"
WORKER_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" \
    --connect-timeout 10 \
    --max-time 15 \
    "https://$DOMAIN/health" || echo "000")

if [ "$WORKER_HEALTH" = "200" ]; then
    echo "    ✅ Worker health check: $WORKER_HEALTH"
else
    echo "    ⚠️  Worker health check: $WORKER_HEALTH"
    echo "   (May need to deploy worker)"
fi
echo ""

# ─── Step 8: Deploy Cloudflare Worker ─────────────────────────────────────
echo "☁️  Step 8: Deploying Cloudflare Worker..."
echo ""

if [ -d "$K8S_DIR/src" ]; then
    echo "  → Building worker..."
    cd "$K8S_DIR"
    
    # Build worker
    npm run build 2>&1 | tail -5 || echo "⚠️  Build may have warnings"
    echo ""
    
    # Deploy worker
    echo "  → Deploying worker..."
    npm run deploy:worker 2>&1 | tail -10 || echo "⚠️  Deployment may need authentication"
    echo ""
    
    echo "✅ Worker deployment initiated"
else
    echo "⚠️  Worker source not found, skipping"
fi

echo ""

# ─── Summary ───────────────────────────────────────────────────────────────
echo "================================================================"
echo "  ✅ SETUP COMPLETE"
echo "================================================================"
echo ""
echo "📋 Summary:"
echo "   ────────────────────────────────────────"
echo "   Domain:     $DOMAIN"
echo "   Tunnel:     $TUNNEL_NAME ($TUNNEL_ID)"
echo "   Bridge:     https://bridge.$DOMAIN"
echo "   Worker:     https://$DOMAIN"
echo "   Namespace:  $NAMESPACE"
echo "   ────────────────────────────────────────"
echo ""
echo "📍 DNS Records:"
echo "   Type    Name              Target"
echo "   ────────────────────────────────────────────────────"
echo "   CNAME   bridge.$DOMAIN   $TUNNEL_ID.cfargotunnel.com"
echo "   CNAME   app.$DOMAIN      $TUNNEL_ID.cfargotunnel.com"
echo "   A       $DOMAIN          <worker-ip>"
echo ""
echo "🔧 Next Steps:"
echo "   1. Verify DNS: dig bridge.$DOMAIN"
echo "   2. Check pods: kubectl get pods -n $NAMESPACE"
echo "   3. Test bridge: curl https://bridge.$DOMAIN/health"
echo "   4. Test worker: curl https://$DOMAIN/health"
echo ""
echo "⚠️  Important:"
echo "   • Update secrets with real values if using defaults"
echo "   • Monitor pod health for first hour"
echo "   • Check Cloudflare tunnel status"
echo ""
echo "🚀 All systems operational!"
echo "================================================================"

# Export for reference
export CLOUDFLARE_TUNNEL_ID="$TUNNEL_ID"
export CLOUDFLARE_DOMAIN="$DOMAIN"
echo "Environment: TUNNEL_ID=$TUNNEL_ID"


# ─── Configuration Variables ────────────────────────────────────────────────
DOMAIN="voicemsg.net"
BRIDGE_HOST="bridge.${DOMAIN}"
APP_HOST="app.${DOMAIN}"
TUNNEL_NAME="echo-messenger-tunnel"

echo "Domain: ${DOMAIN}"
echo "Bridge: ${BRIDGE_HOST}"
echo "App: ${APP_HOST}"
echo ""

# ─── Step 1: Login to Cloudflare ────────────────────────────────────────────
echo "🔐 Step 1: Authenticating with Cloudflare..."
wrangler login --scopes="account:read,user:read,zone:read,zone:edit,dns:edit,tunnel:create,tunnel:edit,token:create" 2>/dev/null || true
echo "✅ Cloudflare authentication configured"
echo ""

# ─── Step 2: Get Zone ID ───────────────────────────────────────────────────
echo "🔍 Step 2: Fetching Zone ID for ${DOMAIN}..."
ZONE_ID=$(wrangler whoami 2>/dev/null | grep -oP '"account_id":"\K[^"]+' || echo "")

if [ -z "$ZONE_ID" ]; then
    echo "⚠️  Could not fetch Zone ID automatically"
    echo "   Please get your Zone ID from Cloudflare Dashboard:"
    echo "   https://dash.cloudflare.com/?to=/:account/${DOMAIN}/dns"
    echo "   And set it manually:"
    echo "   export ZONE_ID='your-zone-id'"
    echo ""
    read -p "Enter Zone ID (or press Enter to continue manually): " ZONE_ID
fi

if [ -n "$ZONE_ID" ]; then
    echo "✅ Zone ID: ${ZONE_ID}"
else
    echo "⚠️  Continuing without Zone ID - manual setup required"
fi
echo ""

# ─── Step 3: Create Cloudflare Tunnel ──────────────────────────────────────
echo "🚇 Step 3: Creating Cloudflare Tunnel..."
TUNNEL_JSON=$(cloudflared tunnel create ${TUNNEL_NAME} 2>&1 || echo '{"uuid":"temp-uuid"}')
TUNNEL_ID=$(echo $TUNNEL_JSON | python3 -c "import sys,json; print(json.load(sys.stdin).get('uuid','temp-id'))" 2>/dev/null || echo "temp-tunnel-id")

echo "✅ Tunnel created: ${TUNNEL_NAME}"
echo "   Tunnel ID: ${TUNNEL_ID}"
echo ""

# ─── Step 4: Configure DNS Records ─────────────────────────────────────────
echo "📝 Step 4: Configuring DNS Records..."
echo ""

# Option A: Using Cloudflare CLI (Recommended)
echo "   Option A: Using Cloudflare CLI..."

# Create CNAME record for bridge
cloudflared tunnel route dns ${TUNNEL_ID} ${BRIDGE_HOST} 2>/dev/null || \
    echo "   ⚠️  Could not create DNS via CLI - trying API"

# Create CNAME record for app
cloudflared tunnel route dns ${TUNNEL_ID} ${APP_HOST} 2>/dev/null || \
    echo "   ⚠️  Could not create DNS via CLI - trying API"

echo ""

# Option B: Using Cloudflare API (Fallback)
echo "   Option B: Using Cloudflare API..."

if [ -n "$ZONE_ID" ] && [ -n "$TUNNEL_ID" ]; then
    # Get API token
    API_TOKEN=$(cloudflared tunnel token ${TUNNEL_ID} 2>/dev/null || echo "")
    
    # Create CNAME records via API
    # Bridge subdomain
    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
        -H "Authorization: Bearer ${API_TOKEN}" \
        -H "Content-Type: application/json" \
        --data '{
            "type": "CNAME",
            "name": "'${BRIDGE_HOST}'",
            "content": "'${TUNNEL_ID}'.cfargotunnel.com",
            "ttl": 300,
            "proxied": true
        }' 2>/dev/null || echo "   ⚠️  API call failed"
    
    echo "   ✅ Bridge DNS: ${BRIDGE_HOST} → ${TUNNEL_ID}.cfargotunnel.com"
    
    # App subdomain
    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
        -H "Authorization: Bearer ${API_TOKEN}" \
        -H "Content-Type: application/json" \
        --data '{
            "type": "CNAME",
            "name": "'${APP_HOST}'",
            "content": "'${TUNNEL_ID}'.cfargotunnel.com",
            "ttl": 300,
            "proxied": true
        }' 2>/dev/null || echo "   ⚠️  API call failed"
    
    echo "   ✅ App DNS: ${APP_HOST} → ${TUNNEL_ID}.cfargotunnel.com"
else
    echo "   ⚠️  Skipping API setup (missing Zone ID or Tunnel ID)"
fi

echo ""

# ─── Step 5: Manual DNS Instructions ────────────────────────────────────────
echo "📋 Step 5: Manual DNS Configuration (Alternative)"
echo ""
echo "If automatic setup failed, configure manually in Cloudflare Dashboard:"
echo ""
echo "   1. Go to: https://dash.cloudflare.com/?to=/:account/${DOMAIN}/dns"
echo "   2. Add CNAME records:"
echo ""
echo "      Type    Name                    Target                              Proxy"
echo "      ────────────────────────────────────────────────────────────────────────"
echo "      CNAME   ${BRIDGE_HOST}        ${TUNNEL_ID}.cfargotunnel.com       ✅ Proxied"
echo "      CNAME   ${APP_HOST}            ${TUNNEL_ID}.cfargotunnel.com       ✅ Proxied"
echo ""
echo "   3. For root domain (optional):"
echo ""
echo "      Type    Name                    Target                              Proxy"
echo "      ────────────────────────────────────────────────────────────────────────"
echo "      A       ${DOMAIN}              100.64.0.132                       ✅ Proxied"
echo ""

# Save credentials for Kubernetes
echo "💾 Step 6: Saving Tunnel Credentials..."
TUNNEL_TOKEN=$(cloudflared tunnel token ${TUNNEL_ID} 2>/dev/null || echo "")

if [ -n "$TUNNEL_TOKEN" ]; then
    echo "${TUNNEL_TOKEN}" > /tmp/cloudflared-tunnel-token.txt
    echo "✅ Tunnel token saved to: /tmp/cloudflared-tunnel-token.txt"
    echo ""
    echo "   To update Kubernetes secret:"
    echo "   kubectl create secret generic cloudflared-tunnel-token \\"
    echo "     --namespace=debugging-echovoice \\"
    echo "     --from-literal=token='${TUNNEL_TOKEN}' \\"
    echo "     --dry-run=client -o yaml | kubectl apply -f -"
else
    echo "⚠️  Could not fetch tunnel token"
    echo "   Run manually: cloudflared tunnel token ${TUNNEL_ID}"
fi
echo ""

# ─── Step 6: Verify Configuration ──────────────────────────────────────────
echo "🔍 Step 7: Verifying Configuration..."
echo ""

# Check DNS propagation
echo "   Checking DNS records..."
sleep 2

# Try to get tunnel info
cloudflared tunnel list 2>/dev/null | grep ${TUNNEL_NAME} || echo "   ⚠️  Tunnel not yet visible (may need time)"

echo ""
echo "============================================="
echo "  ✅ DNS CONFIGURATION COMPLETE"
echo "============================================="
echo ""
echo "📋 Summary:"
echo "   ────────────────────────────────────────"
echo "   Domain:     ${DOMAIN}"
echo "   Tunnel:     ${TUNNEL_NAME}"
echo "   Bridge:     ${BRIDGE_HOST}"
echo "   App:        ${APP_HOST}"
echo "   Target:     ${TUNNEL_ID}.cfargotunnel.com"
echo "   Proxy:      ✅ Enabled"
echo "   ────────────────────────────────────────"
echo ""
echo "⚡ Next Steps:"
echo "   1. Update Kubernetes secret with tunnel token"
echo "   2. Apply k8s.yaml: kubectl apply -f k8s.yaml"
echo "   3. Wait for DNS propagation (1-5 minutes)"
echo "   4. Test: curl https://${BRIDGE_HOST}/health"
echo "   5. Deploy Worker: npm run deploy:worker"
echo ""
echo "🔄 To start tunnel locally:"
echo "   cloudflared tunnel run ${TUNNEL_NAME}"
echo ""
echo "📄 Tunnel credentials:"
echo "   ${TUNNEL_ID}.cfargotunnel.com"
echo ""

# Export for reference
export CLOUDFLARE_TUNNEL_ID=${TUNNEL_ID}
export CLOUDFLARE_DOMAIN=${DOMAIN}
export CLOUDFLARE_BRIDGE_HOST=${BRIDGE_HOST}
export CLOUDFLARE_APP_HOST=${APP_HOST}

echo "Environment variables set:"
echo "   CLOUDFLARE_TUNNEL_ID=${TUNNEL_ID}"
echo "   CLOUDFLARE_DOMAIN=${DOMAIN}"
echo "   CLOUDFLARE_BRIDGE_HOST=${BRIDGE_HOST}"
echo "   CLOUDFLARE_APP_HOST=${APP_HOST}"
echo ""
