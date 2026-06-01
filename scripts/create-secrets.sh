#!/bin/bash
set -e

NAMESPACE="debugging-testcrash-pub"

echo "Creating voicemsg-secrets in namespace $NAMESPACE..."

# Create secret from .env file
# We use --dry-run=client -o yaml | kubectl apply -f - to make it idempotent
kubectl create secret generic voicemsg-secrets \
  --from-env-file=.env \
  -n "$NAMESPACE" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Secrets created successfully."
