#!/bin/bash
set -euo pipefail

echo "========================================"
echo "  Echo Messenger Full Deployment"
echo "========================================"

# Configuration
NAMESPACE="${NAMESPACE:-debugging-testcrash-cloud}"
DOMAIN="voicemsg.net"

echo "Namespace: $NAMESPACE"
echo "Domain: $DOMAIN"
echo ""

# Step 1: Wrangler Login
echo ">>> [1/7] Running wrangler login..."
wrangler login 2>&1 || echo "wrangler login skipped (already logged in or not available)"
echo ""

# Step 2: Cloudflared Login
echo ">>> [2/7] Running cloudflared tunnel login..."
if ! cloudflared tunnel token echo-messenger-tunnel >/dev/null 2>&1; then
  cloudflared tunnel login 2>&1 || echo "cloudflared login skipped"
fi
echo ""

# Step 3: Kubernetes Login
echo ">>> [3/7] Logging into Kubernetes cluster..."
kube-dc login --domain kube-dc.cloud --org debugging 2>&1 || echo "Already logged in"
kube-dc use kube-dc.cloud/debugging/testcrash-cloud 2>&1 || true
echo ""

# Step 4: Deploy Kubernetes Resources
echo ">>> [4/7] Deploying Kubernetes resources..."

echo "  - Applying base resources (Redis + Frontend)..."
kubectl apply -k kubernetes/base/ -n "$NAMESPACE"

echo "  - Applying secrets..."
kubectl apply -f kubernetes/whisper-messenger-env-secret.yaml -n "$NAMESPACE"

echo "  - Applying bridge manager..."
kubectl apply -f kubernetes/mtproto-bridge-manager.yaml -n "$NAMESPACE"

echo "  - Applying Qwen3-ASR..."
kubectl apply -f kubernetes/qwen3-asr.yaml -n "$NAMESPACE"

echo "  - Applying external & floating IPs..."
kubectl apply -f kubernetes/eip-ingress.yaml -n "$NAMESPACE" || echo "  ⚠ EIP already exists or no permission to patch, skipping..."

echo "  - Applying ingress controller..."
kubectl apply -f kubernetes/ingress-nginx.yaml -n "$NAMESPACE"

echo "  - Applying ingress rules..."
kubectl apply -f kubernetes/ingress.yaml -n "$NAMESPACE"

echo "  - Applying monitoring..."
kubectl apply -f kubernetes/grafana.yaml -n "$NAMESPACE" || echo "  ⚠ Monitoring failed"
kubectl apply -f kubernetes/prometheus.yaml -n "$NAMESPACE" || echo "  ⚠ Monitoring failed"

echo "  - Applying Fluentd..."
kubectl apply -f kubernetes/fluentd.yaml -n "$NAMESPACE" || echo "  ⚠ Fluentd failed"

echo "  - Applying RBAC..."
kubectl apply -f kubernetes/rbac.yaml -n "$NAMESPACE"

echo ""

# Step 5: Create Cloudflare Tunnel
echo ">>> [5/7] Setting up Cloudflare tunnel..."

TUNNEL_EXISTS=$(cloudflared tunnel list 2>/dev/null | grep -c "echo-messenger-tunnel" || echo "0")
if [ "$TUNNEL_EXISTS" -eq 0 ]; then
  echo "  - Creating new tunnel..."
  cloudflared tunnel create echo-messenger-tunnel
else
  echo "  - Tunnel already exists"
fi

echo "  - Saving tunnel credentials..."
cloudflared tunnel token echo-messenger-tunnel > cloudflared/credentials.json

echo "  - Setting up DNS routes..."
cloudflared tunnel route dns echo-messenger-tunnel "$DOMAIN" || true
cloudflared tunnel route dns echo-messenger-tunnel "bridge.$DOMAIN" || true
cloudflared tunnel route dns echo-messenger-tunnel "asr.$DOMAIN" || true
cloudflared tunnel route dns echo-messenger-tunnel "grafana.$DOMAIN" || true

echo ""

# Step 6: Start tunnel
echo ">>> [6/7] Starting Cloudflare tunnel..."
nohup cloudflared tunnel run --config cloudflared/config.yaml 3f9deba1-67f8-4086-b6d0-f16759cca9d6 > /tmp/cloudflared.log 2>&1 &
echo "  Tunnel started in background (PID: $!)"
sleep 3
if ps aux | grep cloudflared | grep -q "3f9deba1"; then
  echo "  ✓ Tunnel is running"
else
  echo "  ⚠ Tunnel may not be running - check /tmp/cloudflared.log"
fi

echo ""

# Step 7: Status Check
echo ">>> [7/7] Checking deployment status..."
echo ""
echo "--- Pods ---"
kubectl get pods -n "$NAMESPACE"
echo ""
echo "--- Services ---"
kubectl get svc -n "$NAMESPACE"
echo ""
echo "--- Ingresses ---"
kubectl get ingress -n "$NAMESPACE" 2>/dev/null || true
echo ""
echo "--- External IPs ---"
kubectl get eip -n "$NAMESPACE" 2>/dev/null || echo "EIP CRD not available"
echo ""
echo "--- Floating IPs ---"
kubectl get fip -n "$NAMESPACE" 2>/dev/null || echo "FIP CRD not available"
echo ""

echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "URLs:"
echo "  https://voicemsg.net         - Main frontend"
echo "  https://bridge.voicemsg.net  - Bridge manager"
echo "  https://asr.voicemsg.net     - ASR service"
echo "  https://grafana.voicemsg.net - Grafana dashboard"
echo ""
echo "Logs:"
echo "  kubectl logs -n $NAMESPACE -l app=echo-frontend -f"
echo "  kubectl logs -n $NAMESPACE -l app=mtproto-bridge-manager -f"
echo "  tail -f /tmp/cloudflared.log"
