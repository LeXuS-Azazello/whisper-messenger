#!/bin/bash
#
# Targeted deploy for specific services only.
# Usage:
#   ./scripts/deploy-targeted.sh whisper-service-v2
#   ./scripts/deploy-targeted.sh tg-client samesame
#   npm run deploy whisper-service-v2 tg-client
#

set -euo pipefail

SERVICES=("$@")

if [ ${#SERVICES[@]} -eq 0 ]; then
  echo "Usage: $0 <service1> [service2 ...]"
  echo "Supported: funasr, tg-client, wa-client, wa-manager, samesame, tester, frontend"
  exit 1
fi

# Load env (tolerant to bad lines / typos like "ecure" instead of "SECURE")
if [ -f .env ]; then
  set +u   # do not fail on unbound variables while sourcing
  source .env 2>/dev/null || echo "⚠️  .env has syntax issues (line 39?), continuing with defaults..."
  set -u
fi

DOCKER_HUB_HOST="${DOCKER_HUB_HOST:-hub.docker.com}"
DOCKER_HUB_USERNAME="${DOCKER_HUB_USERNAME:-}"
DOCKER_HUB_PASSWORD="${DOCKER_HUB_PASSWORD:-}"
if [ -n "$DOCKER_HUB_HOST" ]; then
  REPO="${DOCKER_HUB_HOST}/${DOCKER_HUB_USERNAME}"
else
  REPO="${DOCKER_HUB_USERNAME}"
fi
NAMESPACE="${NAMESPACE:-debugging-testcrash-pub}"

echo ">>> Targeted deploy for: ${SERVICES[*]}"

# Ensure login
if command -v kube-dc &> /dev/null; then
  kube-dc use kube-dc.cloud/debugging/testcrash-pub 2>/dev/null || true
fi

for svc in "${SERVICES[@]}"; do
  case "$svc" in
    (funasr)
      echo ""
      echo "=== Building & deploying funasr ==="
       TAG=$(date +%Y%m%d-%H%M%S)
       IMAGE="lexusazazello/voicemsg:funasr-${TAG}"

       docker build -t "$IMAGE" -f funasr/Dockerfile funasr
       docker tag "$IMAGE" "lexusazazello/voicemsg:funasr-latest"
       docker push "lexusazazello/voicemsg:funasr-latest"
       docker rmi "$IMAGE" "lexusazazello/voicemsg:funasr-latest" || true
       
      kubectl rollout restart deployment/funasr -n "$NAMESPACE"
      ;;

    (tg-client|tg)
      echo ""
      echo "=== Building & deploying tg-client ==="

      # Inject shared code
      rm -rf tg-client/shared 2>/dev/null || true
      mkdir -p tg-client/shared
      cp -r shared/* tg-client/shared/ 2>/dev/null || true

      TAG=$(date +%Y%m%d-%H%M%S)
      IMAGE="${REPO}/whisper-tg-client:${TAG}"

      docker build -t "$IMAGE" -f tg-client/Dockerfile tg-client
      docker tag "$IMAGE" "${REPO}/whisper-tg-client:latest"
      docker push "${REPO}/whisper-tg-client:latest"
      docker rmi "$IMAGE" "${REPO}/whisper-tg-client:latest" || true

      kubectl set env deployment/tg-client-manager \
        TG_CLIENT_IMAGE="${REPO}/whisper-tg-client:latest" \
        -n "$NAMESPACE"

      kubectl delete pods -n "$NAMESPACE" -l app=tg-client-user --ignore-not-found || true
      ;;

    (whatsapp-baileys-client|wa-client)
      echo ""
      echo "=== Building & deploying whatsapp-baileys-client ==="

      # Inject shared code
      rm -rf whatsapp-baileys-client/shared 2>/dev/null || true
      mkdir -p whatsapp-baileys-client/shared
      cp -r shared/* whatsapp-baileys-client/shared/ 2>/dev/null || true

      TAG=$(date +%Y%m%d-%H%M%S)
      IMAGE="${REPO}/whatsapp-baileys-client:${TAG}"

      docker build -t "$IMAGE" -f whatsapp-baileys-client/Dockerfile whatsapp-baileys-client
      docker tag "$IMAGE" "${REPO}/whatsapp-baileys-client:latest"
      docker push "${REPO}/whatsapp-baileys-client:latest"
      docker rmi "$IMAGE" "${REPO}/whatsapp-baileys-client:latest" || true

      kubectl set env deployment/whatsapp-baileys-manager \
        WA_BAILEYS_IMAGE="${REPO}/whatsapp-baileys-client:latest" \
        -n "$NAMESPACE"

      kubectl delete pods -n "$NAMESPACE" -l app=wa-baileys-client --ignore-not-found || true
      ;;

    (whatsapp-baileys-manager|wa-manager)
      echo ""
      echo "=== Building & deploying whatsapp-baileys-manager ==="
      TAG=$(date +%Y%m%d-%H%M%S)
      IMAGE="${REPO}/whatsapp-baileys-manager:${TAG}"

      docker build -t "$IMAGE" -f whatsapp-baileys-manager/Dockerfile whatsapp-baileys-manager
      docker tag "$IMAGE" "${REPO}/whatsapp-baileys-manager:latest"
      docker push "${REPO}/whatsapp-baileys-manager:latest"
      docker rmi "$IMAGE" "${REPO}/whatsapp-baileys-manager:latest" || true

      kubectl rollout restart deployment/whatsapp-baileys-manager -n "$NAMESPACE"
      ;;

    (samesame)
      echo ""
      echo "=== Building & deploying samesame ==="
      TAG=$(date +%Y%m%d-%H%M%S)
      IMAGE="${REPO}/samesame:${TAG}"

      docker build -t "$IMAGE" -f samesame/Dockerfile samesame
      docker tag "$IMAGE" "${REPO}/samesame:latest"
      docker push "${REPO}/samesame:latest"
      docker rmi "$IMAGE" "${REPO}/samesame:latest" || true

      kubectl set image deployment/samesame \
        samesame="${REPO}/samesame:latest" \
        -n "$NAMESPACE"

      kubectl rollout restart deployment/samesame -n "$NAMESPACE" || true
      ;;

    (tester)
      echo ""
      echo "=== Building & deploying voicemsg-tester (lightweight) ==="
      
      # Inject shared code
      rm -rf voicemsg-tester/shared 2>/dev/null || true
      mkdir -p voicemsg-tester/shared
      cp -r shared/* voicemsg-tester/shared/ 2>/dev/null || true

      TAG=$(date +%Y%m%d-%H%M%S)
      IMAGE="${REPO}/whisper-tester:${TAG}"

      docker build -t "$IMAGE" -f voicemsg-tester/Dockerfile voicemsg-tester
      docker tag "$IMAGE" "${REPO}/whisper-tester:latest"
      docker push "${REPO}/whisper-tester:latest"
      docker rmi "$IMAGE" "${REPO}/whisper-tester:latest" || true

      kubectl set image deployment/voicemsg-tester tester="${REPO}/whisper-tester:latest" -n "$NAMESPACE"

      kubectl rollout restart deployment/voicemsg-tester -n "$NAMESPACE" || true
      kubectl rollout status deployment/voicemsg-tester -n "$NAMESPACE" --timeout=120s || true
      ;;

    (frontend|echo-frontend)
      echo ""
      echo "=== Building & deploying echo-frontend (main web app) ==="
      
      # Build the typescript server code
      npm run build

      TAG=$(date +%Y%m%d-%H%M%S)
      IMAGE="${REPO}/whisper-frontend:${TAG}"

      docker build -t "$IMAGE" -f Dockerfile .
      docker tag "$IMAGE" "${REPO}/whisper-frontend:latest"
      docker push "${REPO}/whisper-frontend:latest"
      docker rmi "$IMAGE" "${REPO}/whisper-frontend:latest" || true

      kubectl set image deployment/echo-frontend frontend="${REPO}/whisper-frontend:latest" -n "$NAMESPACE"
      kubectl rollout restart deployment/echo-frontend -n "$NAMESPACE" || true

      # Update static assets initContainer
      kubectl set image deployment/echo-static build-assets="${REPO}/whisper-frontend:latest" -n "$NAMESPACE" || true
      kubectl rollout restart deployment/echo-static -n "$NAMESPACE" || true
      ;;

    (default)
      echo "Unknown service: $svc (skipping)"
      ;;
  esac
done

echo ""
echo ">>> Done. Check pods:"
kubectl get pods -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp | tail -10

echo ""
echo ">>> Running docker image prune to clean up dangling layers..."
docker image prune -f || true
