#!/usr/bin/env bash
# scripts/upload-local-sherpa-turbo.sh
#
# Upload locally prepared sherpa-onnx Whisper turbo + VAD + Punctuation
# into the whisper-service-v2 PVC on the cluster.
#
# Supports the full set so the service has everything it needs.
#
# Usage:
# 1. Prepare files locally (recommended structure):
#        mkdir -p whisper-service-v2/local-sherpa-turbo/{whisper,vad,punctuation}
#
#        # Whisper (required)
#        cp turbo-encoder.int8.onnx turbo-decoder.int8.onnx tokens.txt \
#           whisper-service-v2/local-sherpa-turbo/whisper/
#
#        # VAD (highly recommended)
#        wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx \
#             -O whisper-service-v2/local-sherpa-turbo/vad/silero_vad.onnx
#
#        # English punctuation (recommended)
#        # (download from the punctuation release and put model.int8.onnx + bpe.vocab)
#
#   2. Run this script:
#        ./whisper-service-v2/scripts/upload-local-sherpa-turbo.sh
#
# The script will:
#   - Build a tiny alpine image containing only the three model files
#   - Run a one-off Job that copies them into /models/whisper/ on the PVC
#   - Clean up afterwards

set -euo pipefail

# ====================== CONFIG ======================
NAMESPACE="debugging-testcrash-pub"
PVC_NAME="whisper-service-v2-models-pvc"
JOB_NAME="whisper-local-model-uploader"
IMAGE_NAME="local/whisper-sherpa-turbo:latest"

# Base directory with subfolders: whisper/, vad/, punctuation/
LOCAL_BASE_DIR="${1:-$(pwd)/whisper-service-v2/local-sherpa-turbo}"

TMP_YAML="$(mktemp /tmp/whisper-uploader-XXXX.yaml)"
# ====================================================

echo "=== Whisper turbo + VAD + Punctuation local upload ==="
echo "Local base dir   : $LOCAL_BASE_DIR"
echo "Namespace        : $NAMESPACE"
echo "PVC              : $PVC_NAME"
echo

# --- Sanity checks ---
if [[ ! -d "$LOCAL_BASE_DIR" ]]; then
  echo "❌ Directory not found: $LOCAL_BASE_DIR"
  exit 1
fi

WHISPER_DIR="$LOCAL_BASE_DIR/whisper"
VAD_DIR="$LOCAL_BASE_DIR/vad"
PUNCT_DIR="$LOCAL_BASE_DIR/punctuation"

# Whisper is mandatory
if [[ ! -d "$WHISPER_DIR" ]]; then
  echo "❌ Missing required directory: $WHISPER_DIR"
  exit 1
fi

for f in turbo-encoder.int8.onnx turbo-decoder.int8.onnx tokens.txt; do
  if [[ ! -f "$WHISPER_DIR/$f" ]]; then
    echo "❌ Required Whisper file missing: $WHISPER_DIR/$f"
    exit 1
  fi
done
echo "✅ Whisper turbo files found."

# VAD and Punctuation are optional (but strongly recommended)
HAVE_VAD=false
HAVE_PUNCT=false

if [[ -f "$VAD_DIR/silero_vad.onnx" ]]; then
  HAVE_VAD=true
  echo "✅ VAD found"
else
  echo "⚠️  VAD not found (will keep whatever is already on the PVC)"
fi

if [[ -f "$PUNCT_DIR/model.int8.onnx" && -f "$PUNCT_DIR/bpe.vocab" ]]; then
  HAVE_PUNCT=true
  echo "✅ English punctuation found"
else
  echo "⚠️  English punctuation not found (will keep whatever is already on the PVC)"
fi

# --- Build tiny data image (include everything that exists) ---
echo "🔨 Building tiny alpine image with available models..."

mkdir -p /tmp/whisper-upload-stage
rm -rf /tmp/whisper-upload-stage/*

# Always copy whisper
cp -a "$WHISPER_DIR" /tmp/whisper-upload-stage/whisper

# Optionally copy vad and punctuation
if $HAVE_VAD; then
  cp -a "$VAD_DIR" /tmp/whisper-upload-stage/vad
fi

if $HAVE_PUNCT; then
  cp -a "$PUNCT_DIR" /tmp/whisper-upload-stage/punctuation
fi

cat > /tmp/Dockerfile.whisper-uploader <<'EOF'
FROM alpine:3.20
COPY . /src-models/
EOF

docker build -t "$IMAGE_NAME" -f /tmp/Dockerfile.whisper-uploader /tmp/whisper-upload-stage
rm -rf /tmp/whisper-upload-stage /tmp/Dockerfile.whisper-uploader

echo "✅ Image built: $IMAGE_NAME"

# --- Create uploader Job ---
cat > "$TMP_YAML" <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: ${JOB_NAME}
  namespace: ${NAMESPACE}
spec:
  ttlSecondsAfterFinished: 600
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: uploader
          image: ${IMAGE_NAME}
          command: ["/bin/sh", "-c"]
          args:
            - |
              set -e
              echo "Copying models into PVC (/models)..."
              mkdir -p /models
              cp -a /src-models/. /models/
              echo ""
              echo "=== Final contents ==="
              find /models -type f -exec ls -lh {} + 2>/dev/null || true
              echo "✅ All models successfully placed in the PVC"
          volumeMounts:
            - name: models
              mountPath: /models
      volumes:
        - name: models
          persistentVolumeClaim:
            claimName: ${PVC_NAME}
EOF

echo "🚀 Creating uploader Job..."
kubectl apply -f "$TMP_YAML"

# --- Wait for completion ---
echo "⏳ Waiting for Job to finish (copying ~1.4 GB may take 30-90 seconds)..."
set +e
for i in {1..120}; do
  PHASE=$(kubectl get job ${JOB_NAME} -n ${NAMESPACE} -o jsonpath="{.status.succeeded}" 2>/dev/null || echo "")
  if [[ "$PHASE" == "1" ]]; then
    echo "✅ Job completed successfully."
    break
  fi
  FAILED=$(kubectl get job ${JOB_NAME} -n ${NAMESPACE} -o jsonpath="{.status.failed}" 2>/dev/null || echo "")
  if [[ "$FAILED" != "" && "$FAILED" -gt 0 ]]; then
    echo "❌ Job failed."
    kubectl logs job/${JOB_NAME} -n ${NAMESPACE} || true
    exit 1
  fi
  sleep 2
  echo -n "."
done
set -e

# --- Cleanup ---
echo
echo "🧹 Cleaning up..."
kubectl delete job ${JOB_NAME} -n ${NAMESPACE} --ignore-not-found
docker rmi "$IMAGE_NAME" >/dev/null 2>&1 || true
rm -f "$TMP_YAML"

echo
echo "🎉 Done!"
   echo "   Models are now in the PVC at /models/"
   echo "   (whisper + vad + punctuation if you provided them)"
   echo
   echo "   Next step: restart the deployment:"
   echo "     kubectl rollout restart deployment whisper-service-v2 -n ${NAMESPACE}"
   echo
   echo "   Watch pods:"
   echo "     kubectl get pods -n ${NAMESPACE} -l app=whisper-service-v2 -w"
   echo
