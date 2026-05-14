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
IMAGE_NAME="azazellosaraksh/debugging-mtproto-bridge"
TAG=$(date +%Y%m%d-%H%M%S)
FULL_IMAGE="${IMAGE_NAME}:${TAG}"

echo ">>> Building and pushing Docker image: $FULL_IMAGE"
docker build -t "$FULL_IMAGE" .
docker push "$FULL_IMAGE"
echo ""

# Single kustomize apply covers: frontend, redis, network-policy,
# bridge manager (with RBAC), qwen3-asr, ingress, ingress-nginx, tg-client
echo ">>> Applying base resources via kustomize..."
kubectl apply -k kubernetes/base/ -n "$NAMESPACE"
echo ""

# Update image in k8s manifests
echo ">>> Updating image tag to $TAG in Deployment..."
# This must happen AFTER apply -k, otherwise apply -k will overwrite it back to the YAML version
kubectl set image deployment/echo-frontend frontend="$FULL_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/mtproto-bridge-manager mtproto-bridge="$FULL_IMAGE" -n "$NAMESPACE"
kubectl set env deployment/mtproto-bridge-manager TG_CLIENT_IMAGE="$FULL_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/echo-static build-assets="$FULL_IMAGE" -n "$NAMESPACE"
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
