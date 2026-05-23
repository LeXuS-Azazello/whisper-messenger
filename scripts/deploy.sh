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


FORCE_REBUILD=false
for arg in "$@"; do
    if [[ "$arg" == "--force" || "$arg" == "-f" ]]; then
        FORCE_REBUILD=true
        echo ">>> Force rebuild enabled!"
    fi
done

check_dir_changed() {
    local dir=$1
    if [ "$FORCE_REBUILD" = "true" ]; then
        return 0
    fi
    
    local hash_file=".local_build_hashes"
    mkdir -p "$(dirname "$hash_file")"
    touch "$hash_file"
    
    local current_hash
    if [ "$dir" = "." ]; then
        # For frontend, hash root files and src/
        current_hash=$((find . -maxdepth 1 -type f -not -name '.env' -not -name '.local_build_hashes'; find src -type f) | sort | xargs md5sum | md5sum | cut -d' ' -f1)
    else
        current_hash=$(find "$dir" -maxdepth 3 -type f \
            -not -path '*/.*' \
            -not -path '*/node_modules/*' \
            -not -path '*/dist/*' \
            -not -path '*/public/audio/*' \
            -not -path '*/sessions/*' \
            -not -path '*/scratch/*' \
            -not -path '*/.env' \
            -not -name 'secret-update.yaml' \
            -not -name '.local_build_hashes' \
            2>/dev/null | sort | xargs md5sum 2>/dev/null | md5sum | cut -d' ' -f1)
    fi
    
    local old_hash
    old_hash=$(grep "^$dir:" "$hash_file" | cut -d':' -f2 || echo "")
    
    if [ "$current_hash" = "$old_hash" ]; then
        return 1 # Not changed
    else
        # Update hash
        grep -v "^$dir:" "$hash_file" > "${hash_file}.tmp" || true
        echo "$dir:$current_hash" >> "${hash_file}.tmp"
        mv "${hash_file}.tmp" "$hash_file"
        return 0 # Changed
    fi
}

build_and_push_image() {
    local name=$1
    local image_path=$2
    local dockerfile=$3
    local image_tag=$4
    local latest_image="${REPO}/${name}:latest"
    
    # Try to check local docker or pull the latest image to check if it exists
    local has_latest=false
    if docker image inspect "$latest_image" >/dev/null 2>&1; then
        has_latest=true
    elif docker pull "$latest_image" >/dev/null 2>&1; then
        has_latest=true
    fi
    
    # Always fully rebuild the frontend (whisper-frontend) so that all TypeScript / Preact changes
    # (new components, ConnectionsPane, extracted cards etc.) are recompiled via esbuild.
    if [ "$name" = "whisper-frontend" ]; then
        echo ">>> [FORCE REBUILD] whisper-frontend — always recompiling all TypeScript/Preact to pick up UI changes"
        echo ">>> [BUILD] Building and pushing $name..."
        docker build -t "$image_tag" -f "$dockerfile" "$image_path"
        docker tag "$image_tag" "$latest_image"
        docker push "$image_tag"
        docker push "$latest_image"
    elif [ "$has_latest" = "true" ] && ! check_dir_changed "$image_path"; then
        echo ">>> [SKIP BUILD] $name has not changed. Re-tagging existing latest image..."
        docker tag "$latest_image" "$image_tag"
        docker push "$image_tag"
    else
        echo ">>> [BUILD] Building and pushing $name..."
        docker build -t "$image_tag" -f "$dockerfile" "$image_path"
        docker tag "$image_tag" "$latest_image"
        docker push "$image_tag"
        docker push "$latest_image"
    fi
}

FRONTEND_IMAGE="${REPO}/whisper-frontend:${TAG}"
MANAGER_IMAGE="${REPO}/whisper-tg-client-manager:${TAG}"
TG_CLIENT_IMAGE="${REPO}/whisper-tg-client:${TAG}"
TESTER_IMAGE="${REPO}/whisper-tester:${TAG}"
FCA_MANAGER_IMAGE="${REPO}/facebook-fca-manager:${TAG}"
FCA_CLIENT_IMAGE="${REPO}/facebook-fca-client:${TAG}"
INSTA_MANAGER_IMAGE="${REPO}/instagram-fca-manager:${TAG}"
INSTA_CLIENT_IMAGE="${REPO}/instagram-fca-client:${TAG}"
WA_MANAGER_IMAGE="${REPO}/whatsapp-baileys-manager:${TAG}"
WA_CLIENT_IMAGE="${REPO}/whatsapp-baileys-client:${TAG}"
SAMESAME_IMAGE="${REPO}/samesame:${TAG}"
WHISPER_V2_IMAGE="${REPO}/whisper-service-v2:${TAG}"
TRANSLATION_IMAGE="${REPO}/translation-service:${TAG}"


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

# Inject shared/ utilities (samesame.js etc.) into clients that need them
echo ">>> Injecting shared/ code into client build contexts..."
for CLIENT_DIR in tg-client whatsapp-baileys-client facebook-fca-client instagram-fca-client; do
    if [ -d "$CLIENT_DIR" ]; then
        rm -rf "$CLIENT_DIR/shared"
        mkdir -p "$CLIENT_DIR/shared"
        cp -r shared/* "$CLIENT_DIR/shared/"
    fi
done

echo "1. Frontend: $FRONTEND_IMAGE"
build_and_push_image "whisper-frontend" "." "Dockerfile" "$FRONTEND_IMAGE"

echo "2. Client Manager: $MANAGER_IMAGE"
build_and_push_image "whisper-tg-client-manager" "tg-client-manager" "tg-client-manager/Dockerfile" "$MANAGER_IMAGE"

echo "3. TG Client: $TG_CLIENT_IMAGE"
build_and_push_image "whisper-tg-client" "tg-client" "tg-client/Dockerfile" "$TG_CLIENT_IMAGE"

echo "4. Tester Service: $TESTER_IMAGE"
build_and_push_image "whisper-tester" "voicemsg-tester" "voicemsg-tester/Dockerfile" "$TESTER_IMAGE"

echo "5. FCA Manager: $FCA_MANAGER_IMAGE"
build_and_push_image "facebook-fca-manager" "facebook-fca-manager" "facebook-fca-manager/Dockerfile" "$FCA_MANAGER_IMAGE"

echo "6. FCA Client: $FCA_CLIENT_IMAGE"
build_and_push_image "facebook-fca-client" "facebook-fca-client" "facebook-fca-client/Dockerfile" "$FCA_CLIENT_IMAGE"

echo "7. Instagram FCA Manager: $INSTA_MANAGER_IMAGE"
build_and_push_image "instagram-fca-manager" "instagram-fca-manager" "instagram-fca-manager/Dockerfile" "$INSTA_MANAGER_IMAGE"

echo "8. Instagram FCA Client: $INSTA_CLIENT_IMAGE"
build_and_push_image "instagram-fca-client" "instagram-fca-client" "instagram-fca-client/Dockerfile" "$INSTA_CLIENT_IMAGE"

echo "9. WhatsApp Baileys Manager: $WA_MANAGER_IMAGE"
build_and_push_image "whatsapp-baileys-manager" "whatsapp-baileys-manager" "whatsapp-baileys-manager/Dockerfile" "$WA_MANAGER_IMAGE"

echo "10. WhatsApp Baileys Client: $WA_CLIENT_IMAGE"
build_and_push_image "whatsapp-baileys-client" "whatsapp-baileys-client" "whatsapp-baileys-client/Dockerfile" "$WA_CLIENT_IMAGE"

echo "11. Samesame: $SAMESAME_IMAGE"
build_and_push_image "samesame" "samesame" "samesame/Dockerfile" "$SAMESAME_IMAGE"

echo "12. Whisper Service v2: $WHISPER_V2_IMAGE"
build_and_push_image "whisper-service-v2" "whisper-service-v2" "whisper-service-v2/Dockerfile" "$WHISPER_V2_IMAGE"

echo "13. Translation Service: $TRANSLATION_IMAGE"
build_and_push_image "translation-service" "whisper-service-v2/translation-service" "whisper-service-v2/translation-service/Dockerfile" "$TRANSLATION_IMAGE"

# Clean up temporary injections (tdlib + shared code)
if [ "$HAS_CUSTOM_TDLIB" = true ]; then
    echo ">>> Cleaning up injected tdlib directories..."
    rm -rf tg-client-manager/tdlib tg-client/tdlib
fi

echo ">>> Cleaning up injected shared/ directories from clients..."
for CLIENT_DIR in tg-client whatsapp-baileys-client facebook-fca-client instagram-fca-client; do
    rm -rf "$CLIENT_DIR/shared" 2>/dev/null || true
done
echo ""

# Single kustomize apply covers: frontend, redis, mongodb, tg-client-manager,
# tg-client, whisper-v2, voicemsg-cf, real managers (test deployments removed)

echo ">>> Cleaning up old model downloader Jobs (they are now separate)..."
kubectl delete job samesame-model-downloader -n "$NAMESPACE" --ignore-not-found
kubectl delete job -n "$NAMESPACE" -l component=model-downloader --ignore-not-found
# All three downloaders (whisper-v2, translation, samesame) are now auto-launched
# after the corresponding Deployments are Ready (see below).

echo ">>> Applying base resources via kustomize..."
kubectl apply -k kubernetes/base/ -n "$NAMESPACE" || echo "Warning: Some resources failed to apply (likely RBAC restrictions). Proceeding to update images..."
echo ""

# Update image in k8s manifests
echo ">>> Updating image tags in Deployments..."
kubectl set image deployment/echo-frontend frontend="$FRONTEND_IMAGE" -n "$NAMESPACE"

# Update echo-static initContainer so that new static assets (CSS, etc.) are picked up
kubectl set image deployment/echo-static \
  build-assets="$FRONTEND_IMAGE" -n "$NAMESPACE" || true

kubectl rollout restart deployment/echo-static -n "$NAMESPACE" || true

kubectl set image deployment/tg-client-manager manager="$MANAGER_IMAGE" -n "$NAMESPACE"
kubectl set env deployment/tg-client-manager TG_CLIENT_IMAGE="$TG_CLIENT_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/facebook-fca-manager manager="$FCA_MANAGER_IMAGE" -n "$NAMESPACE"
kubectl set env deployment/facebook-fca-manager FCA_CLIENT_IMAGE="$FCA_CLIENT_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/whatsapp-baileys-manager manager="$WA_MANAGER_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/samesame samesame="$SAMESAME_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/whisper-service-v2 whisper-service-v2="$WHISPER_V2_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/translation-service translation-service="$TRANSLATION_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/voicemsg-tester tester="$TESTER_IMAGE" -n "$NAMESPACE"

echo ">>> Whisper Service v2 + Translation Service + Samesame deployed."
echo ">>> Waiting for model deployments to become Ready (polling every 5 seconds)..."

while true; do
    echo ""
    echo "=== Model Deployments ==="
    kubectl get deploy -n "$NAMESPACE" \
        whisper-service-v2 translation-service samesame \
        --no-headers 2>/dev/null || true

    echo ""
    echo "=== Downloader Jobs ==="
    kubectl get jobs -n "$NAMESPACE" -l component=model-downloader --no-headers 2>/dev/null || echo "  (no downloader jobs yet)"

    WHISPER_READY=$(kubectl get deploy whisper-service-v2 -n "$NAMESPACE" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || echo 0)
    TRANSLATION_READY=$(kubectl get deploy translation-service -n "$NAMESPACE" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || echo 0)
    SAMESAME_READY=$(kubectl get deploy samesame -n "$NAMESPACE" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || echo 0)

    if [ "${WHISPER_READY:-0}" -ge 1 ] && [ "${TRANSLATION_READY:-0}" -ge 1 ] && [ "${SAMESAME_READY:-0}" -ge 1 ]; then
        echo ""
        echo ">>> All model deployments are Ready. Launching downloader Jobs now..."
        break
    fi

    echo "Waiting 5 seconds..."
    sleep 5
done

echo ">>> Launching model downloader Jobs (one-time, safe to re-run)..."
kubectl create -f kubernetes/base/whisper-service-v2-downloader-job.yaml -n "$NAMESPACE" || true
kubectl create -f kubernetes/base/translation-service-downloader-job.yaml -n "$NAMESPACE" || true
kubectl create -f kubernetes/base/samesame-downloader-job.yaml -n "$NAMESPACE" || true

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
