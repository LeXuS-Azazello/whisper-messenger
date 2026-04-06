# Plan: Deploy Telegram Bridge + sherpa-onnx to KDC (Kubernetes)

## Target
KDC Kubernetes cluster `whispermsg` в namespace `debugging-whispermsg`

## Option 1: Docker Compose (legacy, for VM)

```bash
scp -r mtproto-bridge user@91.224.11.21:~/
docker-compose up -d --build
```

## Option 2: Kubernetes (recommended)

```bash
# 1. Build and push image to registry (or use buildah/kaniko in cluster)
docker build -t mtproto-bridge ./mtproto-bridge
docker tag mtproto-bridge:latest <registry>/mtproto-bridge:latest
docker push <registry>/mtproto-bridge:latest

# 2. Update k8s.yaml with correct image path

# 3. Apply to cluster
kubectl apply -f mtproto-bridge/k8s.yaml

# 4. Fill secrets
kubectl -n debugging-whispermsg edit secret mtproto-bridge-env

# 5. Check status
kubectl -n debugging-whispermsg get pods
kubectl -n debugging-whispermsg logs -f deployment/mtproto-bridge
```

## Files

| File | Purpose |
|------|---------|
| `mtproto-bridge/Dockerfile` | Node.js 20 + ffmpeg + Paraformer |
| `mtproto-bridge/docker-compose.yml` | Docker Compose (VM) |
| `mtproto-bridge/k8s.yaml` | Kubernetes manifest |
| `mtproto-bridge/transcribe.js` | sherpa-onnx wrapper |
| `mtproto-bridge/index.js` | Modified for local transcription |