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
if ! cloudflared tunnel list >/dev/null 2>&1; then
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

echo "  - Applying RBAC..."
kubectl apply -f kubernetes/rbac.yaml -n "$NAMESPACE"

echo ""

# Step 5: Setup Kubernetes-based Tunnel
echo ">>> [5/7] Setting up Kubernetes-based Cloudflare tunnel..."

TUNNEL_NAME="echo-messenger-tunnel"
TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}' || echo "")

if [ -z "$TUNNEL_ID" ]; then
  echo "  - Creating new tunnel: $TUNNEL_NAME"
  TUNNEL_ID=$(cloudflared tunnel create "$TUNNEL_NAME" | grep -oP 'Created tunnel \K[a-f0-9-]+')
fi

echo "  - Tunnel ID: $TUNNEL_ID"

# Get credentials file path (usually ~/.cloudflared/ID.json)
CREDS_FILE="$HOME/.cloudflared/$TUNNEL_ID.json"

if [ -f "$CREDS_FILE" ]; then
  echo "  - Creating Kubernetes secret for tunnel credentials..."
  kubectl create secret generic cloudflared-tunnel-credentials \
    --from-file=credentials.json="$CREDS_FILE" \
    --namespace "$NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -
else
  echo "  ⚠ Could not find credentials file at $CREDS_FILE"
  echo "  Trying to use token from cloudflared tunnel token..."
  TOKEN=$(cloudflared tunnel token "$TUNNEL_NAME")
  # Decode token (it's base64 encoded JSON)
  DECODED_JSON=$(echo "$TOKEN" | base64 -d)
  echo "  - Creating Kubernetes secret from token..."
  kubectl create secret generic cloudflared-tunnel-credentials \
    --from-literal=credentials.json="$DECODED_JSON" \
    --namespace "$NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -
fi

echo "  - Applying tunnel deployment..."
kubectl apply -f kubernetes/cloudflared-tunnel.yaml -n "$NAMESPACE"

echo ""

# Step 6: DNS Routes
echo ">>> [6/7] Updating DNS routes..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN" || true
cloudflared tunnel route dns "$TUNNEL_NAME" "bridge.$DOMAIN" || true
cloudflared tunnel route dns "$TUNNEL_NAME" "asr.$DOMAIN" || true
cloudflared tunnel route dns "$TUNNEL_NAME" "grafana.$DOMAIN" || true

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
kubectl get ingress -n "$NAMESPACE"
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
