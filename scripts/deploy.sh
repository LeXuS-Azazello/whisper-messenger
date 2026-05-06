#!/bin/bash
set -e

NAMESPACE="${NAMESPACE:-debugging-testcrash-cloud}"
EXCLUDE="${EXCLUDE:-^$}"

echo "Deploying to namespace: $NAMESPACE"

# Find and apply all yaml files, excluding specified
for yaml in kubernetes/*.yaml; do
  if echo "$yaml" | grep -qvE "$EXCLUDE"; then
    echo "Applying: $yaml"
    kubectl apply -f "$yaml" -n "$NAMESPACE" 2>/dev/null || true
  else
    echo "Skipping (excluded): $yaml"
  fi
done

echo "Deployment complete"
kubectl get pods -n "$NAMESPACE"