#!/bin/bash
set -e

NAMESPACE="${NAMESPACE:-testcrash-cloud}"
EXCLUDE="${EXCLUDE:-qwen3-asr}"

echo "Deploying to namespace: $NAMESPACE"
[ -n "$EXCLUDE" ] && echo "Excluding: $EXCLUDE"

if [ -d "kubernetes/overlays/$NAMESPACE" ]; then
  echo "Using kustomize overlay"
  kubectl apply -k kubernetes/overlays/$NAMESPACE
else
  echo "No overlay found, deploying raw yaml files"
  for yaml in kubernetes/*.yaml; do
    skip=false
    for pattern in $EXCLUDE; do
      if echo "$yaml" | grep -qi "$pattern"; then
        echo "Skipping: $yaml"
        skip=true
        break
      fi
    done
    if [ "$skip" = false ]; then
      kubectl apply -f "$yaml" -n "$NAMESPACE" 2>/dev/null || true
    fi
  done
fi

kubectl get pods -n "$NAMESPACE" 2>/dev/null || true