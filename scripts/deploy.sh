#!/bin/bash
set -euo pipefail

echo "========================================"
echo "  Echo Messenger K8s Deployment"
echo "========================================"

NAMESPACE="${NAMESPACE:-debugging-testcrash-pub}"
echo "Namespace: $NAMESPACE"
echo ""

# Login
echo ">>> Logging into Kubernetes cluster..."
kube-dc login --domain kube-dc.cloud --org debugging 2>&1 || echo "Already logged in"
kube-dc use kube-dc.cloud/debugging/testcrash-pub 2>&1 || true
echo ""

# Image configuration
TAG=$(date +%Y%m%d-%H%M%S)
REPO="azazellosaraksh"

FRONTEND_IMAGE="${REPO}/whisper-frontend:${TAG}"
BRIDGE_IMAGE="${REPO}/whisper-bridge-manager:${TAG}"
TG_CLIENT_IMAGE="${REPO}/whisper-tg-client:${TAG}"

echo ">>> Building and pushing Docker images..."

echo "1. Frontend: $FRONTEND_IMAGE"
docker build -t "$FRONTEND_IMAGE" -f Dockerfile .
docker push "$FRONTEND_IMAGE"

echo "2. Bridge Manager: $BRIDGE_IMAGE"
docker build -t "$BRIDGE_IMAGE" -f mtproto-bridge/Dockerfile mtproto-bridge/
docker push "$BRIDGE_IMAGE"

echo "3. TG Client: $TG_CLIENT_IMAGE"
docker build -t "$TG_CLIENT_IMAGE" -f tg-client/Dockerfile tg-client/
docker push "$TG_CLIENT_IMAGE"
echo ""

# Single kustomize apply covers: frontend, redis, network-policy,
# bridge manager (with RBAC), qwen3-asr, ingress, ingress-nginx, tg-client
echo ">>> Applying base resources via kustomize..."
kubectl apply -k kubernetes/base/ -n "$NAMESPACE"
echo ""

# Update image in k8s manifests
echo ">>> Updating image tags in Deployments..."
kubectl set image deployment/echo-frontend frontend="$FRONTEND_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/mtproto-bridge-manager mtproto-bridge="$BRIDGE_IMAGE" -n "$NAMESPACE"
kubectl set env deployment/mtproto-bridge-manager TG_CLIENT_IMAGE="$TG_CLIENT_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/echo-static build-assets="$FRONTEND_IMAGE" -n "$NAMESPACE"
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
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Endpoints:"
echo "  https://voicemsg.net         -> Frontend"
echo "  https://bridge.voicemsg.net  -> Bridge Manager"
echo "  https://asr.voicemsg.net     -> Qwen3-ASR (Ollama)"
echo "  https://grafana.voicemsg.net -> Grafana Dashboard"
