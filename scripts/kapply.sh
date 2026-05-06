#!/bin/bash
set -e

NAMESPACE="${NAMESPACE:-testcrash-cloud}"

echo "Deploying to $NAMESPACE"
kubectl apply -k kubernetes/overlays/$NAMESPACE