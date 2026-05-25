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
SKIP_BUILD=false
for arg in "$@"; do
    if [[ "$arg" == "--force" || "$arg" == "-f" ]]; then
        FORCE_REBUILD=true
        echo ">>> Force rebuild enabled!"
    fi
    if [[ "$arg" == "--skip-build" ]]; then
        SKIP_BUILD=true
        echo ">>> Skip build mode - using existing images in Harbor"
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
    
    if [ "$SKIP_BUILD" = "true" ]; then
        echo ">>> [SKIP BUILD] Using existing ${latest_image} in Harbor"
        docker pull "$latest_image" 2>/dev/null || echo ">>> WARNING: Could not pull $latest_image"
        return 0
    fi
    
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
        if [ ! -d "whisper" ]; then
            echo ">>> [SKIP HEAVY] whisper-frontend: 'whisper/' directory missing (heavy ML models — forbidden on local machine per AGENTS.md)"
            echo ">>>            Using latest image from Harbor (models are downloaded on-cluster by downloader jobs anyway)."
            if docker pull "${REPO}/whisper-frontend:latest" >/dev/null 2>&1; then
                docker tag "${REPO}/whisper-frontend:latest" "$image_tag"
                docker tag "${REPO}/whisper-frontend:latest" "$latest_image"
                docker push "$image_tag" || true
                docker push "$latest_image" || true
            else
                echo ">>>            (No previous whisper-frontend image in Harbor — frontend assets may be stale)"
            fi
            return 0
        fi
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
for CLIENT_DIR in tg-client whatsapp-baileys-client facebook-fca-client instagram-fca-client voicemsg-tester; do
    if [ -d "$CLIENT_DIR" ]; then
        rm -rf "$CLIENT_DIR/shared"
        mkdir -p "$CLIENT_DIR/shared"
        cp -r shared/* "$CLIENT_DIR/shared/"
    fi
done

echo "12. Whisper Service v2: $WHISPER_V2_IMAGE"
build_and_push_image "whisper-service-v2" "whisper-service-v2" "whisper-service-v2/Dockerfile" "$WHISPER_V2_IMAGE"

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


# Clean up temporary injections (tdlib + shared code)
if [ "$HAS_CUSTOM_TDLIB" = true ]; then
    echo ">>> Cleaning up injected tdlib directories..."
    rm -rf tg-client-manager/tdlib tg-client/tdlib
fi

echo ">>> Cleaning up injected shared/ directories from clients..."
for CLIENT_DIR in tg-client whatsapp-baileys-client facebook-fca-client instagram-fca-client voicemsg-tester; do
    rm -rf "$CLIENT_DIR/shared" 2>/dev/null || true
done
echo ""

# Single kustomize apply covers: frontend, redis, mongodb, tg-client-manager,
# tg-client, whisper-v2, voicemsg-cf, real managers (test deployments removed)

if [ "$SKIP_BUILD" = "true" ]; then
    echo ">>> [SKIP BUILD] Skipping image updates - using existing Harbor images"
    echo ">>> Applying base resources via kustomize..."
    kubectl apply -k kubernetes/base/ -n "$NAMESPACE" || echo "Warning: Some resources failed to apply (likely RBAC restrictions)."
else
    echo ">>> Checking if model downloader Jobs are needed (skip if models already present)..."
    # We no longer blindly delete + recreate downloaders.
    # The downloader scripts themselves are idempotent (marker files + size checks).
    # We only launch them if the corresponding Deployment does not have ready replicas yet.

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

echo ">>> Whisper Service v2 + Samesame deployed."

    # CRITICAL ORDER (prevents chicken-egg + local downloads):
    # 1. Launch downloader Jobs IMMEDIATELY after apply (they are safe to run multiple times thanks to marker files).
    # 2. The Deployments may start in "not ready" state (models missing) — this is expected and desired.
    # 3. The Jobs download into the PVC (only on Kubernetes nodes, never locally).
    # 4. Once files appear, the containers load the models and become Ready.
    # This guarantees that heavy model downloads happen ONLY via the dedicated Jobs on the cluster.

    echo ">>> Checking whether model downloader Jobs are needed..."

    # Whisper models check (key files)
    WHISPER_READY=$(kubectl get deploy whisper-service-v2 -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)
    if [ "${WHISPER_READY:-0}" -ge 1 ]; then
      echo ">>> Whisper models appear ready (deployment has ready replicas) — skipping downloader Job"
    else
      echo ">>> Launching whisper-service-v2 model downloader Job..."
      kubectl create -f kubernetes/base/whisper-service-v2-downloader-job.yaml -n "$NAMESPACE" || true
    fi

    # Samesame models check
    SAMESAME_READY=$(kubectl get deploy samesame -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)
    if [ "${SAMESAME_READY:-0}" -ge 1 ]; then
      echo ">>> Samesame models appear ready — skipping downloader Job"
    else
      echo ">>> Launching samesame model downloader Job..."
      kubectl create -f kubernetes/base/samesame-downloader-job.yaml -n "$NAMESPACE" || true
    fi

    echo ">>> Waiting for model deployments to become Ready (downloaders run only if needed)..."

    while true; do
        echo ""
        echo "=== Model Deployments ==="
        kubectl get deploy -n "$NAMESPACE" \
            whisper-service-v2 samesame \
            --no-headers 2>/dev/null || true

        echo ""
        echo "=== Downloader Jobs (component=model-downloader) ==="
        kubectl get jobs -n "$NAMESPACE" -l component=model-downloader --no-headers 2>/dev/null || echo "  (no downloader jobs)"

        WHISPER_READY=$(kubectl get deploy whisper-service-v2 -n "$NAMESPACE" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || echo 0)
        SAMESAME_READY=$(kubectl get deploy samesame -n "$NAMESPACE" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || echo 0)

        # Check if the latest downloader jobs have succeeded (we don't care about old ones)
        WHISPER_JOB_DONE=$(kubectl get jobs -n "$NAMESPACE" -l component=model-downloader --no-headers -o jsonpath='{range .items[*]}{.status.succeeded}{" "}{end}' 2>/dev/null | grep -E ' [1-9]' || echo "")
        SAMESAME_JOB_DONE=$(kubectl get jobs -n "$NAMESPACE" -l component=model-downloader --no-headers -o jsonpath='{range .items[*]}{.status.succeeded}{" "}{end}' 2>/dev/null | grep -E ' [1-9]' || echo "")

        if [ "${WHISPER_READY:-0}" -ge 1 ] && [ "${SAMESAME_READY:-0}" -ge 1 ]; then
            echo ""
            echo ">>> Both model deployments are Ready."
            break
        fi

        echo "Waiting 10 seconds... (Jobs download only on Kubernetes — never on your laptop)"
        sleep 10
    done
fi

echo ">>> Deleting existing user tg-client pods to force recreation with new image..."
kubectl delete pods -l app=tg-client-user -n "$NAMESPACE" --ignore-not-found
echo ""

echo ">>> Deleting existing user wa-baileys-client pods to force recreation with new image..."
kubectl delete pods -l app=wa-baileys-client -n "$NAMESPACE" --ignore-not-found
echo ""

echo ">>> Deleting existing user facebook-fca-client pods to force recreation with new image..."
kubectl delete pods -l app=facebook-fca-client -n "$NAMESPACE" --ignore-not-found
echo ""

echo ">>> Deleting existing user instagram-fca-client pods to force recreation with new image..."
kubectl delete pods -l app=instagram-fca-client -n "$NAMESPACE" --ignore-not-found
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
