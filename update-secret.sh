#!/bin/bash

# Update Kubernetes secret from .env file
# Usage: ./update-secret.sh

set -e

NAMESPACE="debugging-testcrash-pub"
SECRET_NAME="whisper-messenger-env"

echo "Updating Kubernetes secret $SECRET_NAME in namespace $NAMESPACE from .env file..."

# Create a temporary file with the secret data
TEMP_FILE=$(mktemp)

# Convert .env to base64 encoded values for Kubernetes secret
cat .env | while IFS='=' read -r key value; do
    if [[ ! -z "$key" && ! $key =~ ^# ]]; then
        echo "  $key: $(echo -n "$value" | base64 -w 0)" >> "$TEMP_FILE"
    fi
done

# Create the secret YAML
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

echo "Applying secret update..."
kubectl apply -f secret-update.yaml

# Cleanup
rm -f "$TEMP_FILE" secret-update.yaml

echo "Secret updated successfully!"
echo "You may need to restart deployments that use these secrets."