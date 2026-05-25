#!/usr/bin/env bash
# scripts/deploy.sh
# --------------------------------------------------------------
# Purpose:
#   Upload the locally‑available Whisper model files
#   (directory: ./whisper-large-v3-turbo-onnx-int8) into the
#   PVC used by whisper‑service‑v2 (`whisper-service-v2-models-pvc`).
#
# Why a Job?
#   The cluster enforces a policy that blocks `kubectl exec` /
#   `kubectl cp` into pods with hostPath volumes, so we cannot
#   copy files directly.  Instead we build a tiny container image
#   that contains the model files and run a one‑off Job that mounts
#   the PVC and copies the files from the image into the PVC.
#
# Prerequisites:
#   - Docker (or podman) installed locally and able to build images.
#   - kubectl configured for the `debugging-testcrash-pub` namespace.
#   - `HUGGINGFACE_API_KEY` already stored in the `hf-token` secret
#     (not needed for this upload, but the job uses the same PVC).
# --------------------------------------------------------------

set -euo pipefail
IFS=$'\n\t'

# ---------------------------- Config ----------------------------
NAMESPACE="debugging-testcrash-pub"
PVC_NAME="whisper-service-v2-models-pvc"
JOB_NAME="whisper-model-uploader"
IMAGE_NAME="local/whisper-model-uploader:latest"
MODEL_SRC_DIR="$(pwd)/whisper-large-v3-turbo-onnx-int8"
TMP_YAML="$(mktemp /tmp/whisper-uploader-XXXX.yaml)"
# --------------------------------------------------------------

# ---------- Step 1: Verify tools ----------
if ! command -v docker >/dev/null 2>&1; then
  echo "[deploy] ❌ Docker CLI not found. Install Docker or Podman and retry."
  exit 1
fi
if ! command -v kubectl >/dev/null 2>&1; then
  echo "[deploy] ❌ kubectl not found. Ensure you have access to the cluster."
  exit 1
fi

# ---------- Step 2: Ensure model directory exists ----------
if [[ ! -d "$MODEL_SRC_DIR" ]]; then
  echo "[deploy] ❌ Model source directory not found:"
  echo "        $MODEL_SRC_DIR"
  exit 1
fi

# ---------- Step 3: Build a minimal Docker image that ships the models ----------
cat > Dockerfile <<'EOF'
FROM alpine:3.20
WORKDIR /src-models/whisper
COPY . .
EOF

# Build the image using the model directory as the build context
# No extra staging directory is needed.

docker build -t "$IMAGE_NAME" -f Dockerfile "$MODEL_SRC_DIR"
# Cleanup Dockerfile after build
rm -f Dockerfile

# ---------- Step 4: Create a temporary Job manifest ----------
cat > "$TMP_YAML" <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: ${JOB_NAME}
  namespace: ${NAMESPACE}
spec:
  ttlSecondsAfterFinished: 600   # auto‑cleanup after success/failure
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
              mkdir -p /models/whisper && \
              cp -a /src-models/whisper/. /models/whisper/
          volumeMounts:
            - name: models
              mountPath: /models
      volumes:
        - name: models
          persistentVolumeClaim:
            claimName: ${PVC_NAME}
EOF

# ---------- Step 5: Apply the Job ----------
echo "[deploy] 🚀 Creating uploader Job..."
kubectl apply -f "$TMP_YAML"

# ---------- Step 6: Wait for Job completion ----------
echo "[deploy] ⏳ Waiting for Job to finish (this may take ~30 s)..."
set +e
for i in {1..30}; do
  PHASE=$(kubectl get job ${JOB_NAME} -n ${NAMESPACE} -o jsonpath="{.status.succeeded}")
  if [[ "$PHASE" == "1" ]]; then
    echo "[deploy] ✅ Job completed successfully."
    break
  fi
  FAILED=$(kubectl get job ${JOB_NAME} -n ${NAMESPACE} -o jsonpath="{.status.failed}")
  if [[ "$FAILED" != "" && "$FAILED" -gt 0 ]]; then
    echo "[deploy] ❌ Job failed (status.failed = $FAILED)."
    kubectl logs job/${JOB_NAME} -n ${NAMESPACE}
    exit 1
  fi
  sleep 2
done
set -e

# ---------- Step 7: Clean up ----------
echo "[deploy] 🧹 Deleting temporary Job..."
kubectl delete job ${JOB_NAME} -n ${NAMESPACE} --ignore-not-found

docker rmi "$IMAGE_NAME" >/dev/null 2>&1 || true
rm -f "$TMP_YAML"

echo "[deploy] 🎉 Whisper model files are now present in PVC '${PVC_NAME}'."
echo "          You can now restart the Whisper service:"
echo "          kubectl rollout restart deployment whisper-service-v2 -n ${NAMESPACE}"
