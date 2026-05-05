# Echo Messenger - Infrastructure Setup

## Domain: voicemsg.net

## Architecture Overview

This is a multi-tenant voice-to-text bridge connecting Meta (FB/Insta), WhatsApp, Telegram to Whisper AI.

### Components

1. **Cloudflare Worker** (Frontend + API Proxy)
   - Handles webhooks and UI
   - Route: `voicemsg.net/*`
   
2. **Kubernetes Cluster** (MTProto Bridge + Whisper ASR)
   - MTProto Bridge Manager (1 pod)
   - User Pods (dynamic, per user)
   - Qwen3-ASR for transcription (1 pod)
   - Redis for caching and session management (1 pod)

### Resource Allocation

- **Qwen3-ASR**: 4 CPU / 16Gi RAM (requests) → 8 CPU / 32Gi RAM (limits)
- **Redis**: 100m CPU / 256Mi RAM (requests) → 500m CPU / 512Mi RAM (limits)
- **Bridge Manager**: 200m CPU / 256Mi RAM (requests) → 500m CPU / 512Mi RAM (limits)
- **User Pods**: 100m CPU / 128Mi RAM (requests) → 500m CPU / 512Mi RAM (limits)
- **Storage**: 100Gi for Qwen3-ASR models

## Quick Start

### 1. Deploy Everything

```bash
# Full deployment
./scripts/deploy.sh
```

### 2. Manual Deployment

```bash
# Configure Kubernetes
kube-dc login --domain kube-dc.cloud --org debugging
kube-dc use kube-dc.cloud/debugging/echovoice

# Apply Kubernetes resources
kubectl apply -f k8s.yaml
kubectl apply -f kubernetes/whisper-messenger-env-secret.yaml
kubectl apply -f kubernetes/cloudflared-tunnel.yaml

# Deploy Cloudflare Worker
npm run deploy:worker

# Deploy Bridge
npm run deploy:server

# Deploy Frontend
npm run deploy:k8s
```

### 3. Setup Cloudflare Tunnel

```bash
# Run setup script
./scripts/setup-cloudflare.sh
```

## DNS Configuration

### Cloudflare

| Type  | Name | Target | Proxy |
|-------|------|--------|-------|
| A | voicemsg.net | 100.64.0.132 | ✓ |
| A | bridge.voicemsg.net | 100.64.0.132 | ✓ |
| A | app.voicemsg.net | 100.64.0.132 | ✓ |

## Files

- `k8s.yaml` - Main Kubernetes configuration
- `kubernetes/whisper-messenger-env-secret.yaml` - Environment secrets
- `kubernetes/cloudflared-tunnel.yaml` - Cloudflare tunnel
- `wrangler.toml` - Cloudflare Worker configuration
- `mtproto-bridge/k8s.yaml` - Bridge-specific K8s resources
- `mtproto-bridge/k8s.yaml` - Bridge manager resources

## Verification

```bash
# Check pod status
kubectl get pods -n debugging-echovoice

# Check services
kubectl get svc -n debugging-echovoice

# Test health endpoints
curl https://voicemsg.net/health
curl http://localhost:3000/health
```

## Troubleshooting

### Pods not starting

```bash
# Check pod logs
kubectl logs -f <pod-name> -n debugging-echovoice

# Check events
kubectl get events -n debugging-echovoice --sort-by='.lastTimestamp'
```

### DNS issues

```bash
# Verify DNS resolution
dig voicemsg.net

# Check Cloudflare tunnel
kubectl logs -f -l app=cloudflared-tunnel -n debugging-echovoice
```

### Redis connection errors

```bash
# Test Redis connectivity
kubectl exec -it -n debugging-echovoice <redis-pod> -- redis-cli ping
```

## Scaling

```bash
# Scale bridge manager
kubectl scale deployment mtproto-bridge-manager --replicas=2 -n debugging-echovoice

# Scale frontend
kubectl scale deployment echo-frontend --replicas=2 -n debugging-echovoice
```

## Security

- All secrets are stored in Kubernetes Secrets
- Network policies isolate user pods
- Redis requires no external access
- Qwen3-ASR is internal only
- Cloudflare tunnel provides secure ingress

## Backup

```bash
# Backup secrets
kubectl get secret whisper-messenger-env -n debugging-echovoice -o yaml > backup-secret.yaml

# Backup PVCs
kubectl get pvc -n debugging-echovoice -o yaml > backup-pvc.yaml
```

## Monitoring

```bash
# Resource usage
kubectl top pods -n debugging-echovoice
kubectl top nodes

# Pod restarts
kubectl get pods -n debugging-echovoice --sort-by='.status.containerStatuses[0].restartCount'
```
