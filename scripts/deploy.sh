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

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    echo ">>> Recreating whisper-messenger-env secret from .env..."
    kubectl delete secret whisper-messenger-env -n "$NAMESPACE" --ignore-not-found
    kubectl create secret generic whisper-messenger-env --from-env-file=.env -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
fi

# Image configuration
TAG=$(date +%Y%m%d-%H%M%S)
HARBOR_HOST="${HARBOR_HOST:-harbor.dev.takatan.cloud}"
PROJECT_NAME="${HARBOR_PROJECT:-devcenter}"
REPO="${HARBOR_HOST}/${PROJECT_NAME}"

# Ensure Harbor project exists
if [[ -n "${HARBOR_USER:-}" && -n "${HARBOR_PASS:-}" ]]; then
    echo ">>> Checking/Creating Harbor project '$PROJECT_NAME'..."
    API_URL="${HARBOR_API_URL:-https://${HARBOR_HOST}/api/v2.0}"
    curl -s -u "$HARBOR_USER:$HARBOR_PASS" -X POST "${API_URL}/projects" \
      -H "Content-Type: application/json" \
      -d "{\"project_name\": \"$PROJECT_NAME\", \"metadata\": {\"public\": \"false\"}}" || echo "Project might already exist (ensuring it is private)..."
    
    # Update project to private if it exists
    curl -s -u "$HARBOR_USER:$HARBOR_PASS" -X PUT "${API_URL}/projects/$PROJECT_NAME" \
      -H "Content-Type: application/json" \
      -d "{\"metadata\": {\"public\": \"false\"}}" || true

    echo ">>> Creating Kubernetes imagePullSecret 'harbor-pull-secret'..."
    kubectl create secret docker-registry harbor-pull-secret \
      --docker-server="$HARBOR_HOST" \
      --docker-username="$HARBOR_USER" \
      --docker-password="$HARBOR_PASS" \
      --docker-email="admin@voicemsg.net" \
      -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    echo ">>> Logging into Harbor..."
    echo "$HARBOR_PASS" | docker login "$HARBOR_HOST" -u "$HARBOR_USER" --password-stdin
    
    echo ">>> Mirroring third-party images to Harbor..."
    IMAGES_TO_MIRROR=(
        "mongo:latest"
        "redis:7-alpine"
        "python:3.12-slim"
    )
    
    for IMG in "${IMAGES_TO_MIRROR[@]}"; do
        # Get base name without prefix
        BASE=$(echo "$IMG" | awk -F'/' '{print $NF}')
        NAME="${BASE%:*}"
        TAG_PART="${BASE#*:}"
        [[ "$NAME" == "$TAG_PART" ]] && TAG_PART="latest"
    
        
        TARGET="${REPO}/${NAME}:${TAG_PART}"
        
        # Skip mirroring if already exists (to save bandwidth)
        if docker manifest inspect "$TARGET" >/dev/null 2>&1; then
            echo ">>> Image $TARGET already exists in Harbor, skipping mirror."
            continue
        fi

        echo "Mirroring $IMG -> $TARGET"
        for i in {1..3}; do
            docker pull "$IMG" && break || echo "Failed to pull $IMG, retrying ($i/3)..."
            sleep 2
        done
        docker tag "$IMG" "$TARGET"
        docker push "$TARGET"
    done
fi


FRONTEND_IMAGE="${REPO}/whisper-frontend:${TAG}"
MANAGER_IMAGE="${REPO}/whisper-tg-client-manager:${TAG}"
TG_CLIENT_IMAGE="${REPO}/whisper-tg-client:${TAG}"

echo ">>> Building and pushing Docker images..."

echo "1. Frontend: $FRONTEND_IMAGE"
docker build -t "$FRONTEND_IMAGE" -f Dockerfile .
docker tag "$FRONTEND_IMAGE" "${REPO}/whisper-frontend:latest"
docker push "$FRONTEND_IMAGE"
docker push "${REPO}/whisper-frontend:latest"

echo "2. Client Manager: $MANAGER_IMAGE"
docker build -t "$MANAGER_IMAGE" -f tg-client-manager/Dockerfile tg-client-manager/
docker tag "$MANAGER_IMAGE" "${REPO}/whisper-tg-client-manager:latest"
docker push "$MANAGER_IMAGE"
docker push "${REPO}/whisper-tg-client-manager:latest"

echo "3. TG Client: $TG_CLIENT_IMAGE"
docker build -t "$TG_CLIENT_IMAGE" -f tg-client/Dockerfile tg-client/
docker tag "$TG_CLIENT_IMAGE" "${REPO}/whisper-tg-client:latest"
docker push "$TG_CLIENT_IMAGE"
docker push "${REPO}/whisper-tg-client:latest"
echo ""

# Single kustomize apply covers: frontend, redis, mongodb, tg-client-manager,
# tg-client, qwen3-asr, ingress, ingress-nginx, monitoring
echo ">>> Applying base resources via kustomize..."
kubectl apply -k kubernetes/base/ -n "$NAMESPACE" || echo "Warning: Some resources failed to apply (likely RBAC restrictions). Proceeding to update images..."
echo ""

# Update image in k8s manifests
echo ">>> Updating image tags in Deployments..."
kubectl set image deployment/echo-frontend frontend="$FRONTEND_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/tg-client-manager manager="$MANAGER_IMAGE" -n "$NAMESPACE"
kubectl set env deployment/tg-client-manager TG_CLIENT_IMAGE="$TG_CLIENT_IMAGE" -n "$NAMESPACE"
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
