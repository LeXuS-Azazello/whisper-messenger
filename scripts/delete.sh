#!/bin/bash
set -e

NAMESPACE="${NAMESPACE:-debugging-testcrash-cloud}"

echo "Deleting namespace: $NAMESPACE"
kubectl delete namespace "$NAMESPACE" --ignore-not-found=true
echo "Delete complete"