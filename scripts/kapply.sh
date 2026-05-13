#!/bin/bash
set -e

NAMESPACE="${NAMESPACE:-testcrash-pub}"

echo "Deploying to $NAMESPACE"
kubectl apply -k kubernetes/overlays/$NAMESPACE