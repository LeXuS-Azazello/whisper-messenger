#!/bin/bash
set -euo pipefail

echo "========================================"
echo "  Echo Messenger K8s Deployment"
echo "========================================"

DOMAIN=$(grep '^DOMAIN=' .env 2>/dev/null | cut -d= -f2 || echo 'voicemsg.net')
NAMESPACE=$(grep '^NAMESPACE=' .env 2>/dev/null | cut -d= -f2 || echo 'debugging-testcrash-pub')
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
      --docker-email="admin@$(grep '^DOMAIN=' .env | cut -d= -f2)" \
      -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    echo ">>> Logging into Harbor..."
    echo "$HARBOR_PASS" | docker login "$HARBOR_HOST" -u "$HARBOR_USER" --password-stdin
    
    echo ">>> Mirroring third-party images to Harbor..."
    IMAGES_TO_MIRROR=(
        "mongo:latest"
        "redis:7-alpine"
        "python:3.12-slim"
        "mongo-express:latest"
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
TESTER_IMAGE="${REPO}/whisper-tester:${TAG}"
WHISPER_IMAGE="${REPO}/whisper-service:${TAG}"
FCA_MANAGER_IMAGE="${REPO}/facebook-fca-manager:${TAG}"
FCA_CLIENT_IMAGE="${REPO}/facebook-fca-client:${TAG}"
WA_MANAGER_IMAGE="${REPO}/whatsapp-baileys-manager:${TAG}"
WA_CLIENT_IMAGE="${REPO}/whatsapp-baileys-client:${TAG}"

echo ">>> Building and pushing Docker images..."

# Inject custom-compiled TDLib if present in workspace root
HAS_CUSTOM_TDLIB=false
if [ -d "tdlib" ]; then
    echo ">>> Custom-compiled TDLib found in workspace root. Copying into build directories..."
    rm -rf tg-client-manager/tdlib tg-client/tdlib
    cp -r tdlib tg-client-manager/
    cp -r tdlib tg-client/
    HAS_CUSTOM_TDLIB=true
fi

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

echo "4. Tester Service: $TESTER_IMAGE"
docker build -t "$TESTER_IMAGE" -f voicemsg-tester/Dockerfile voicemsg-tester/
docker tag "$TESTER_IMAGE" "${REPO}/whisper-tester:latest"
docker push "$TESTER_IMAGE"
docker push "${REPO}/whisper-tester:latest"

echo "5. Whisper Service: $WHISPER_IMAGE"
docker build -t "$WHISPER_IMAGE" -f whisper-service/Dockerfile whisper-service/
docker tag "$WHISPER_IMAGE" "${REPO}/whisper-service:latest"
docker push "$WHISPER_IMAGE"
docker push "${REPO}/whisper-service:latest"

echo "6. FCA Manager: $FCA_MANAGER_IMAGE"
docker build -t "$FCA_MANAGER_IMAGE" -f facebook-fca-manager/Dockerfile facebook-fca-manager/
docker tag "$FCA_MANAGER_IMAGE" "${REPO}/facebook-fca-manager:latest"
docker push "$FCA_MANAGER_IMAGE"
docker push "${REPO}/facebook-fca-manager:latest"

echo "7. FCA Client: $FCA_CLIENT_IMAGE"
docker build -t "$FCA_CLIENT_IMAGE" -f facebook-fca-client/Dockerfile facebook-fca-client/
docker tag "$FCA_CLIENT_IMAGE" "${REPO}/facebook-fca-client:latest"
docker push "$FCA_CLIENT_IMAGE"
docker push "${REPO}/facebook-fca-client:latest"

echo "8. WhatsApp Baileys Manager: $WA_MANAGER_IMAGE"
docker build -t "$WA_MANAGER_IMAGE" -f whatsapp-baileys-manager/Dockerfile whatsapp-baileys-manager/
docker tag "$WA_MANAGER_IMAGE" "${REPO}/whatsapp-baileys-manager:latest"
docker push "$WA_MANAGER_IMAGE"
docker push "${REPO}/whatsapp-baileys-manager:latest"

echo "9. WhatsApp Baileys Client: $WA_CLIENT_IMAGE"
docker build -t "$WA_CLIENT_IMAGE" -f whatsapp-baileys-client/Dockerfile whatsapp-baileys-client/
docker tag "$WA_CLIENT_IMAGE" "${REPO}/whatsapp-baileys-client:latest"
docker push "$WA_CLIENT_IMAGE"
docker push "${REPO}/whatsapp-baileys-client:latest"

# Clean up temporary tdlib injections
if [ "$HAS_CUSTOM_TDLIB" = true ]; then
    echo ">>> Cleaning up injected tdlib directories..."
    rm -rf tg-client-manager/tdlib tg-client/tdlib
fi
echo ""

# Single kustomize apply covers: frontend, redis, mongodb, tg-client-manager,
# tg-client, whisper-turbo, voicemsg-cf, monitoring
echo ">>> Applying base resources via kustomize..."
kubectl apply -k kubernetes/base/ -n "$NAMESPACE" || echo "Warning: Some resources failed to apply (likely RBAC restrictions). Proceeding to update images..."
echo ""

# Update image in k8s manifests
echo ">>> Updating image tags in Deployments..."
kubectl set image deployment/echo-frontend frontend="$FRONTEND_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/tg-client-manager manager="$MANAGER_IMAGE" -n "$NAMESPACE"
kubectl set env deployment/tg-client-manager TG_CLIENT_IMAGE="$TG_CLIENT_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/voicemsg-tester tester="$TESTER_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/whisper-service whisper-service="$WHISPER_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/facebook-fca-manager manager="$FCA_MANAGER_IMAGE" -n "$NAMESPACE"
kubectl set env deployment/facebook-fca-manager FCA_CLIENT_IMAGE="$FCA_CLIENT_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/whatsapp-baileys-manager manager="$WA_MANAGER_IMAGE" -n "$NAMESPACE"
echo ""

echo ">>> Deleting existing user tg-client pods to force recreation with new image..."
kubectl delete pods -l app=tg-client-user -n "$NAMESPACE" --ignore-not-found
echo ""

echo ">>> Deleting existing user wa-baileys-client pods to force recreation with new image..."
kubectl delete pods -l app=wa-baileys-client -n "$NAMESPACE" --ignore-not-found
echo ""


echo "=== Status ==="
echo ""
echo "--- Pods ---"
kubectl get pods -n "$NAMESPACE"
echo ""
echo "--- Services ---"
kubectl get svc -n "$NAMESPACE"
echo ""
echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Endpoints:"
echo "  https://${DOMAIN}         -> Frontend"
