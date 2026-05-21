#!/bin/bash

# Update Kubernetes secrets from .env file
# Usage: ./update-secret.sh
#
# Splits .env into two secrets:
#   whisper-messenger-env  — everything except HUGGINGFACE_API_KEY
#   huggingface-token      — HUGGINGFACE_API_KEY only

set -e

NAMESPACE=$(grep '^NAMESPACE=' .env 2>/dev/null | cut -d= -f2 || echo 'debugging-testcrash-pub')

echo "=== Updating $NAMESPACE secrets from .env ==="

# ── HF token → separate secret ───────────────────────────────────────────────
HF_ENV_KEY="HUGGINGFACE_API_KEY"
HF_SECRET_NAME="huggingface-token"
HF_TOKEN=$(grep "^${HF_ENV_KEY}=" .env | cut -d= -f2-)

if [[ -n "$HF_TOKEN" ]]; then
  HF_B64=$(echo -n "$HF_TOKEN" | base64 -w 0)
  cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: $HF_SECRET_NAME
  namespace: $NAMESPACE
type: Opaque
data:
  HUGGING_FACE_HUB_TOKEN: $HF_B64
EOF
  echo "[OK] $HF_SECRET_NAME updated"
else
  echo "[SKIP] $HF_ENV_KEY not found in .env, skipping $HF_SECRET_NAME"
fi

# ── Everything else → whisper-messenger-env ─────────────────────────────────
SECRET_NAME="whisper-messenger-env"

TEMP_FILE=$(mktemp)

cat .env | while IFS='=' read -r key value; do
    if [[ -n "$key" && ! $key =~ ^# && "$key" != "$HF_ENV_KEY" ]]; then
        # Strip surrounding quotes that are sometimes present in .env values
        value="${value%\"}"; value="${value#\"}"
        echo "  $key: $(echo -n "$value" | base64 -w 0)" >> "$TEMP_FILE"
    fi
done

cat > secret-update.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: $SECRET_NAME
  namespace: $NAMESPACE
type: Opaque
data:
EOF

cat "$TEMP_FILE" >> secret-update.yaml

echo "[OK] Applying $SECRET_NAME..."
kubectl apply -f secret-update.yaml

rm -f "$TEMP_FILE" secret-update.yaml

echo ""
echo "Secrets updated successfully!"
echo "  → $HF_SECRET_NAME  (HUGGING_FACE_HUB_TOKEN)"
echo "  → $SECRET_NAME     (all other .env vars)"