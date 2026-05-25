#!/bin/bash
# Script to switch ASR models in Kubernetes to save CPU

MODE=$1
# Try to get NAMESPACE from .env if it exists in current dir, otherwise default
if [ -f ".env" ]; then
    NAMESPACE=$(grep '^NAMESPACE=' '.env' | cut -d= -f2)
fi
if [ -z "$NAMESPACE" ]; then
    NAMESPACE="debugging-testcrash-pub"
fi

if [ "$MODE" == "whisper" ]; then
    echo ">>> Switching to Whisper (large-v3-turbo)..."
    kubectl patch deployment funasr -n $NAMESPACE -p '{"spec":{"replicas":0}}' 2>/dev/null || true
    kubectl patch deployment sensevoice -n $NAMESPACE -p '{"spec":{"replicas":0}}' 2>/dev/null || true
    kubectl patch deployment whisper-service-v2 -n $NAMESPACE -p '{"spec":{"replicas":1}}'
    
    # Update Redis config so whisper.ts knows the URL
    echo ">>> Updating Redis config for Whisper..."
    kubectl exec -n $NAMESPACE deploy/redis -- redis-cli HSET stats config_local_whisper_url "http://whisper-service-v2.$NAMESPACE.svc.cluster.local:8000"
    
    echo ">>> DONE. ASR is now Whisper."

elif [ "$MODE" == "sensevoice" ]; then
    echo ">>> Switching to SenseVoice..."
    
    # Ensure SenseVoice deployment exists
    kubectl apply -f kubernetes/base/sensevoice.yaml -n $NAMESPACE
    
    kubectl patch deployment funasr -n $NAMESPACE -p '{"spec":{"replicas":0}}' 2>/dev/null || true
    kubectl patch deployment whisper-service-v2 -n $NAMESPACE -p '{"spec":{"replicas":0}}'
    kubectl patch deployment sensevoice -n $NAMESPACE -p '{"spec":{"replicas":1}}'
    
    # Update Redis config so whisper.ts knows the URL
    echo ">>> Updating Redis config for SenseVoice..."
    kubectl exec -n $NAMESPACE deploy/redis -- redis-cli HSET stats config_local_whisper_url "http://sensevoice.$NAMESPACE.svc.cluster.local:50000"
    
    echo ">>> DONE. ASR is now SenseVoice."

elif [ "$MODE" == "funasr" ]; then
    echo ">>> Switching to FunASR..."
    
    # Ensure FunASR deployment exists
    kubectl apply -f kubernetes/base/funasr.yaml -n $NAMESPACE
    
    kubectl patch deployment sensevoice -n $NAMESPACE -p '{"spec":{"replicas":0}}' 2>/dev/null || true
    kubectl patch deployment whisper-service-v2 -n $NAMESPACE -p '{"spec":{"replicas":0}}'
    kubectl patch deployment funasr -n $NAMESPACE -p '{"spec":{"replicas":1}}'
    
    # Update Redis config so whisper.ts knows the URL
    echo ">>> Updating Redis config for FunASR..."
    kubectl exec -n $NAMESPACE deploy/redis -- redis-cli HSET stats config_local_whisper_url "http://funasr.$NAMESPACE.svc.cluster.local:50001"
    
    echo ">>> DONE. ASR is now FunASR."

else
    echo "Usage: $0 [whisper|sensevoice|funasr]"
    exit 1
fi
