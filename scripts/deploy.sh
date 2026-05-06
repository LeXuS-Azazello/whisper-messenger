#!/bin/bash
set -e

NAMESPACE="${NAMESPACE:-testcrash-cloud}"

echo "Deploying to namespace: $NAMESPACE"

if [ -d "kubernetes/overlays/$NAMESPACE" ]; then
  echo "Using kustomize overlay"
  kubectl apply -k kubernetes/overlays/$NAMESPACE
else
  echo "No overlay found, deploying raw yaml files"
  for yaml in kubernetes/*.yaml; do
    if echo "$yaml" | grep -qvE "$EXCLUDE"; then
      kubectl apply -f "$yaml" -n "$NAMESPACE" 2>/dev/null || true
    fi
  done
fi

kubectl get pods -n "$NAMESPACE" 2>/dev/null || true