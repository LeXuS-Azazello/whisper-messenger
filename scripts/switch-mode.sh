#!/bin/bash
# Script to switch between Direct IP and Cloudflare Tunnel modes

MODE=$1
NAMESPACE="debugging-testcrash-pub"

if [ "$MODE" == "direct" ]; then
    echo ">>> Switching to DIRECT IP mode..."
    # 1. Ensure Ingress is applied
    kubectl apply -f kubernetes/ingress.yaml -n $NAMESPACE
    # 2. Stop the tunnel deployment to avoid conflicts
    kubectl delete deployment cloudflared -n $NAMESPACE --ignore-not-found
    echo ">>> DONE. Don't forget to update Cloudflare DNS to point A records to 91.224.11.110"

elif [ "$MODE" == "tunnel" ]; then
    echo ">>> Switching to CLOUDFLARE TUNNEL mode..."
    # 1. Apply tunnel resources
    kubectl apply -f kubernetes/cloudflared-tunnel.yaml -n $NAMESPACE
    # 2. Restart tunnel to be sure
    kubectl rollout restart deployment cloudflared -n $NAMESPACE
    echo ">>> DONE. Don't forget to update Cloudflare DNS to use CNAMEs for the tunnel ID."

else
    echo "Usage: $0 [direct|tunnel]"
    exit 1
fi
