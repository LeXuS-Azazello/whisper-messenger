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
  echo "Supported: whisper-service-v2, tg-client, samesame, tester"
  exit 1
fi

# Load env (tolerant to bad lines / typos like "ecure" instead of "SECURE")
if [ -f .env ]; then
  set +u   # do not fail on unbound variables while sourcing
  source .env 2>/dev/null || echo "⚠️  .env has syntax issues (line 39?), continuing with defaults..."
  set -u
fi

HARBOR_HOST="${HARBOR_HOST:-harbor.dev.takatan.cloud}"
HARBOR_PROJECT="${HARBOR_PROJECT:-devcenter}"
REPO="${HARBOR_HOST}/${HARBOR_PROJECT}"
NAMESPACE="${NAMESPACE:-debugging-testcrash-pub}"

echo ">>> Targeted deploy for: ${SERVICES[*]}"

# Ensure login
if command -v kube-dc &> /dev/null; then
  kube-dc use kube-dc.cloud/debugging/testcrash-pub 2>/dev/null || true
fi

for svc in "${SERVICES[@]}"; do
  case "$svc" in
    whisper-service-v2|whisper)
      echo ""
      echo "=== Building & deploying whisper-service-v2 ==="
      TAG=$(date +%Y%m%d-%H%M%S)
      IMAGE="${REPO}/whisper-service-v2:${TAG}"

      docker build -t "$IMAGE" -f whisper-service-v2/Dockerfile whisper-service-v2
      docker tag "$IMAGE" "${REPO}/whisper-service-v2:latest"
      docker push "${REPO}/whisper-service-v2:latest"

      kubectl set image deployment/whisper-service-v2 \
        whisper-service-v2="${REPO}/whisper-service-v2:latest" \
        whisper-worker-v2="${REPO}/whisper-service-v2:latest" \
        -n "$NAMESPACE"

      kubectl rollout restart deployment/whisper-service-v2 -n "$NAMESPACE"
      ;;

    tg-client|tg)
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

      kubectl set env deployment/tg-client-manager \
        TG_CLIENT_IMAGE="${REPO}/whisper-tg-client:latest" \
        -n "$NAMESPACE"

      kubectl delete pods -n "$NAMESPACE" -l app=tg-client-user --ignore-not-found || true
      ;;

    samesame)
      echo ""
      echo "=== Building & deploying samesame ==="
      TAG=$(date +%Y%m%d-%H%M%S)
      IMAGE="${REPO}/samesame:${TAG}"

      docker build -t "$IMAGE" -f samesame/Dockerfile samesame
      docker tag "$IMAGE" "${REPO}/samesame:latest"
      docker push "${REPO}/samesame:latest"

      kubectl set image deployment/samesame \
        samesame="${REPO}/samesame:latest" \
        -n "$NAMESPACE"

      kubectl rollout restart deployment/samesame -n "$NAMESPACE" || true
      ;;

    tester)
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

      kubectl set image deployment/voicemsg-tester tester="${REPO}/whisper-tester:latest" -n "$NAMESPACE"

      kubectl rollout restart deployment/voicemsg-tester -n "$NAMESPACE" || true
      kubectl rollout status deployment/voicemsg-tester -n "$NAMESPACE" --timeout=120s || true
      ;;

    *)
      echo "Unknown service: $svc (skipping)"
      ;;
  esac
done

echo ""
echo ">>> Done. Check pods:"
kubectl get pods -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp | tail -10
