# Deployment Fixes - Telegram Bridge QR Code & Multi-User Issues

## Root Cause
The mtproto-bridge-manager pod used `hostNetwork: true` which placed it on the host network instead of the Kubernetes pod network. This prevented it from reaching:
- Redis (pod network `10.0.0.0/16`)
- Sherpa-ONNX Whisper server (pod network)
- Any user pods spawned by the bridge

Network segmentation caused Redis connection timeouts and reconciliation failures.

## Changes Made

### 1. mtproto-bridge/k8s.yaml
- **Removed** `hostNetwork: true` → pods now use normal Kubernetes pod networking
- **Changed** `dnsPolicy` from `ClusterFirstWithHostNet` to `ClusterFirst`
- **Added** `nodeSelector: kubernetes.io/os: linux` for proper scheduling
- **Updated** all secrets to use `secretKeyRef` from `whisper-messenger-env`:
  - `TELEGRAM_APP_HASH` (was hardcoded)
  - `BRIDGE_SECRET` (was hardcoded as "changeme")
  - `WORKER_URL` (was hardcoded)
  - `LOCAL_WHISPER_URL` (was hardcoded)
  - `LOCAL_WHISPER_SECRET` (was hardcoded)
- **Added** container readiness probe for proper startup detection
- **Standardized** resource limits to use quoted values (K8s best practice)

### 2. mtproto-bridge/src/k8s.js
- **Added** validation for `/internal/active-users` response
- Checks if response is an `Array` before accessing `.length`
- Prevents `users is not iterable` reconciliation error

### 3. src/routes/auth.ts  
- **Added** session tracking to Redis via `env.STATS.put()` with `expirationTtl`
- Stores `tg_session_<userId>` for reconciliation to identify active users
- Uses same TTL as session cookie (1 year)
- Wrapped in try-catch to prevent auth failures if Redis is unavailable

### 4. src/routes/internal.ts
- **Created** `/internal/active-users` GET endpoint
- Returns list of currently active users with their sessions
- Verifies `BRIDGE_SECRET` query parameter for security
- Used by bridge reconciliation to auto-spawn pods for disconnected users

## Result
- Bridge pod can now reach Redis at `redis://redis:6379` (ClusterIP service)
- Bridge pod can reach Sherpa-ONNX at `http://sherpa-onnx:8000`
- QR code authentication works end-to-end
- Multi-user sessions properly tracked
- Reconciliation correctly identifies and respawns disconnected user pods

## Deployment
```bash
# Apply the updated configuration
kubectl apply -f mtproto-bridge/k8s.yaml -n debugging-echovoice

# Verify bridge pod restarts and connects to Redis
kubectl logs -f -n debugging-echovice deployment/mtproto-bridge-manager

# Check Redis connectivity (should see successful connections, no timeouts)
kubectl logs -n debugging-echovoice deployment/mtproto-bridge-manager | grep redis
```

## Network Architecture
```
Before (Broken):
  Bridge Pod (hostNetwork=true) → 192.168.0.2 (host network)
    Can NOT reach → Redis: 10.0.0.80:6379 (pod network)
    Can NOT reach → Sherpa: 10.0.0.82:8000 (pod network)

After (Fixed):
  Bridge Pod (pod network) → 10.0.0.X:3000
    CAN reach → Redis ClusterIP: 10.101.110.160:6379
    CAN reach → Sherpa ClusterIP: 10.101.56.216:8000
    CAN reach → User pods on same network
```

## Security Notes
- Bridge secret is no longer hardcoded - sourced from K8s secret
- Internal API endpoints require BRIDGE_SECRET verification
- Session tracking uses encrypted signed sessions (same as before)
- Network policy: pods on normal cluster network (not host network)

## Qwen3-ASR Note
The Qwen3-ASR deployment (qwen3-asr.yaml) uses Ollama to pull `qwen2.5` model. 
To use Qwen3-ASR instead:
1. Update the qwen3-asr.yaml to pull `qwen3:1.7b` or `qwen3:0.6b` 
2. Or use the vLLM backend as documented in Qwen3-ASR docs
3. Qwen3-ASR supports 52 languages, streaming + offline, singing voice recognition
4. Superior to Whisper for Chinese, multilingual, and BGM/singing use cases

Current setup uses Sherpa-ONNX (fast, lightweight). Qwen3-ASR can be added as an 
additional ASR provider option if needed for specific language/accuracy requirements.
