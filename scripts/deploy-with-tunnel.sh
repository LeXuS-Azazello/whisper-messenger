#!/bin/bash
set -euo pipefail

echo "========================================"
echo "  Echo Messenger Full Deployment"
echo "========================================"

NAMESPACE="${NAMESPACE:-debugging-testcrash-cloud}"
DOMAIN="voicemsg.net"

echo "Namespace: $NAMESPACE"
echo "Domain: $DOMAIN"
echo ""

# Step 1: Kubernetes Login
echo ">>> [1/6] Logging into Kubernetes cluster..."
kube-dc login --domain kube-dc.cloud --org debugging 2>&1 || echo "Already logged in"
kube-dc use kube-dc.cloud/debugging/testcrash-cloud 2>&1 || true
echo ""

# Step 2: Deploy Kubernetes Resources via kustomize
echo ">>> [2/6] Deploying core resources (kustomize base + secrets)..."
kubectl apply -k kubernetes/base/ -n "$NAMESPACE"
kubectl apply -f kubernetes/whisper-messenger-env-secret.yaml -n "$NAMESPACE"
echo ""

# Step 3: Deploy Monitoring
echo ">>> [3/6] Deploying monitoring..."
kubectl apply -f kubernetes/grafana.yaml -n "$NAMESPACE" || echo "  ⚠ Grafana failed"
kubectl apply -f kubernetes/prometheus.yaml -n "$NAMESPACE" || echo "  ⚠ Prometheus failed"
echo ""

# Step 4: Setup Kubernetes-based Tunnel
echo ">>> [4/6] Setting up Kubernetes-based Cloudflare tunnel..."

TUNNEL_NAME="echo-messenger-tunnel"
echo "  - Looking for existing tunnel: $TUNNEL_NAME"
TUNNEL_ID=$(cloudflared tunnel list | grep -w "$TUNNEL_NAME" | awk '{print $1}' | head -n 1 || echo "")

if [ -z "$TUNNEL_ID" ]; then
  echo "  - Tunnel not found in list, trying to create or fetch token..."
  if ! cloudflared tunnel create "$TUNNEL_NAME" > /tmp/tunnel_create_out 2>&1; then
    echo "  - Tunnel likely already exists, fetching existing ID..."
    TUNNEL_ID=$(cloudflared tunnel list | grep -w "$TUNNEL_NAME" | awk '{print $1}' | head -n 1 || echo "")
  else
    TUNNEL_ID=$(grep -oP 'Created tunnel \K[a-f0-9-]+' /tmp/tunnel_create_out || echo "")
  fi
fi

echo "  - Tunnel ID: $TUNNEL_ID"

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

# Step 5: DNS Routes
echo ">>> [5/6] Updating DNS routes..."
cloudflared tunnel route dns "$TUNNEL_ID" "$DOMAIN" || true
cloudflared tunnel route dns "$TUNNEL_ID" "bridge.$DOMAIN" || true
cloudflared tunnel route dns "$TUNNEL_ID" "asr.$DOMAIN" || true
cloudflared tunnel route dns "$TUNNEL_ID" "grafana.$DOMAIN" || true

echo ""

# Step 6: Status Check
echo ">>> [6/6] Checking deployment status..."
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
