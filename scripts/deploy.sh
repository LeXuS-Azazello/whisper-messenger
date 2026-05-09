#!/bin/bash
set -euo pipefail

echo "========================================"
echo "  Echo Messenger K8s Deployment"
echo "========================================"

NAMESPACE="${NAMESPACE:-debugging-testcrash-cloud}"
echo "Namespace: $NAMESPACE"
echo ""

# Login
echo ">>> Logging into Kubernetes cluster..."
kube-dc login --domain kube-dc.cloud --org debugging 2>&1 || echo "Already logged in"
kube-dc use kube-dc.cloud/debugging/testcrash-cloud 2>&1 || true
echo ""

# Single kustomize apply covers: frontend, redis, network-policy,
# bridge manager (with RBAC), qwen3-asr, ingress, ingress-nginx, tg-client
echo ">>> Applying base resources via kustomize..."
kubectl apply -k kubernetes/base/ -n "$NAMESPACE"
echo ""

echo ">>> Applying secrets..."
kubectl apply -f kubernetes/whisper-messenger-env-secret.yaml -n "$NAMESPACE"
echo ""

echo ">>> Applying monitoring (outside base — optional)..."
kubectl apply -f kubernetes/grafana.yaml -n "$NAMESPACE"
kubectl apply -f kubernetes/prometheus.yaml -n "$NAMESPACE"
echo ""

echo ">>> Applying Fluentd..."
kubectl apply -f kubernetes/fluentd.yaml -n "$NAMESPACE"
echo ""

echo ">>> Applying External IP..."
kubectl apply -f kubernetes/eip-ingress.yaml -n "$NAMESPACE"
echo ""

echo ">>> Applying Cloudflared tunnel agent..."
kubectl apply -f kubernetes/cloudflared-tunnel.yaml -n cloudflared 2>&1 || true
echo ""

echo "=== Status ==="
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
echo "--- Cloudflared ---"
kubectl get pods,svc -n cloudflared 2>/dev/null || true

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Endpoints:"
echo "  https://voicemsg.net         -> Frontend (via Cloudflare tunnel)"
echo "  https://bridge.voicemsg.net  -> Bridge Manager"
echo "  https://asr.voicemsg.net     -> Qwen3-ASR (Ollama)"
echo "  https://grafana.voicemsg.net -> Grafana Dashboard"
