# Echo Messenger — Project Overview

**Domain:** voicemsg.net  
**Repository:** `https://github.com/LeXuS-Azazello/whisper-messenger`  
**Last Updated:** 2026-05-05

---

## 📋 Executive Summary

Echo Messenger — это multi-tenant voice-to-text bridge, который подключает мессенджеры (Telegram, Facebook/Instagram, WhatsApp, LINE, Threads) к Whisper AI для транскрибации голосовых сообщений.

**Architecture:**
- **Kubernetes Cluster** — MTProto bridge (Telegram) + Whisper transcription services
- **Cloudflare Tunnel** — Доступ к Kubernetes сервисам

---

## 🏗️ System Architecture

### Components

| Component | Technology | Port | Purpose |
|-----------|------------|------|---------|
| **MTProto Manager** | Node.js + telegram | 3000 | QR/phone auth, pod orchestration |
| **MTProto User Pods** | Node.js + telegram | dynamic | Per-user Telegram clients |
| **Qwen3-ASR** | Ollama | 11434 | Audio transcription |
| **Redis** | Redis | 6379 | Session & KV storage |


### Data Flow

```
User sends voice → Telegram → MTProto User Pod → Downloads audio →
Transcribe (Whisper/Qwen) → Translate (optional Ollama) → Reply with text
```

---

## 📁 Project Structure

```
fb_insta_voice_msg/
├── src/                          # Cloudflare Worker (Hono)
│   ├── index.ts                  # Main entry, routing
│   ├── types.ts                  # TypeScript interfaces
│   ├── session.ts                # HMAC session signing
│   ├── logger.ts                 # Error logging to KV
│   ├── auth_ui.tsx              # Landing page auth UI
│   ├── dashboard_ui.tsx         # User dashboard UI
│   ├── routes/
│   │   ├── auth.ts              # Auth endpoints (Google, TG)
│   │   ├── admin.ts             # Admin dashboard
│   │   ├── dashboard.ts         # User dashboard
│   │   └── internal.ts          # Internal bridge comms
│   ├── telegram.ts              # Telegram Bot API helpers
│   └── whisper.ts               # Whisper service wrapper
│
├── mtproto-bridge/              # Telegram MTProto client
│   ├── index.js                 # Express server (MANAGER/USER)
│   ├── src/
│   │   ├── auth.js              # Phone & QR auth logic
│   │   ├── config.js            # Env config + Redis
│   │   ├── k8s.js               # Kubernetes pod orchestration
│   │   ├── user.js              # User client & message handler
│   │   └── utils.js             # Client factory, helpers
│   ├── transcribe.js            # Audio transcription wrapper
│   ├── k8s.yaml                 # K8s deployment (MANAGER)
│   ├── rbac.yaml                # ServiceAccount + RBAC
│   └── build.sh                 # Docker build & push
│
├── kubernetes/
│   ├── whisper-messenger-env-secret.yaml  # All env vars (Secret)
│   ├── bridge-ingress.yaml                # Ingress for mtproto
│   ├── redis.yaml                         # Redis deployment
│   ├── cloudflared-tunnel.yaml            # Cloudflare tunnel
│   └── qwen3-asr/qwen3-asr.yaml           # Qwen3-ASR service
│
├── wrangler.toml                # Cloudflare Worker config
├── package.json                 # Worker dependencies
├── AGENTS.md                    # This file
└── .kilo/                       # Kilo CLI config

```

---

## 🔐 Authentication Flow

### 1. Google OAuth (Primary)
```
User → Google OAuth → /auth/google/callback → Creates user_meta record → Sets session cookie
```

### 2. Telegram Phone Login
```
Frontend: /auth/send-code (phone)
  ↓
Bridge Manager: POST /send-code → Telegram sends code
  ↓
Frontend: /auth/verify-code (phone + code)
  ↓
Bridge Manager: POST /verify-code → Returns session string
  ↓
Frontend stores session in KV + spawns user pod via /spawn
```

### 3. Telegram QR Login (Simplified)
```
Frontend: POST /auth/qr-start
  ↓
Bridge: Creates client, generates QR (tg://login?token=...)
  ↓
Frontend: Displays QR, polls /auth/qr-check every 2.5s
  ↓
Bridge: Waits for user to scan in Telegram app
  ↓
When authenticated: returns { done: true, session, userId, firstName }
  ↓
Frontend: Saves session, spawns user pod
```

**QR Timeouts:**
- Frontend: 2 minutes (dashoard_ui.tsx:816)
- Server-side: 5 minutes (auth.js:128, newly added)

**2FA Handling:**
- Phone login: returns `{ requiresPassword: true }` → shows password input
- QR login: currently shows alert only (needs UI improvement)

---

## 🔑 Environment Variables

### Worker (wrangler.toml)
| Variable | Purpose | Example |
|----------|---------|---------|
| `WORKER_URL` | Public URL of worker | https://voicemsg.net |
| `SESSION_SECRET` | HMAC signing key | `ZAEBIS_EBANY...` |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth | from GCP |
| `META_APP_ID/SECRET` | FB/Insta webhooks | from Meta |
| `TELEGRAM_APP_ID/HASH` | Telegram API creds | 13867088 / a9ba48... |
| `REDIS_URL` | Redis connection | redis://redis:6379 |

### Bridge (K8s Secret: whisper-messenger-env)
| Variable | Purpose |
|----------|---------|
| `MODE` | MANAGER or USER |
| `TG_API_ID/HASH` | Telegram API (same as worker) |
| `BRIDGE_SECRET` | Internal API auth (shared secret) |
| `WORKER_URL` | Worker URL for callbacks |
| `TARGET_USER_ID` | USER mode: which user this pod serves |
| `TG_SESSION` | USER mode: Telegram session string |
| `QWEN_ASR_URL` | Qwen3-ASR endpoint |
| `POD_NAMESPACE` | Auto-injected K8s namespace |

---

## 🚀 Deployment

### Prerequisites
- Kubernetes cluster (kube-dc.cloud, org: debugging)
- Cloudflare account (voicemsg.net zone)
- Redis running in cluster
- Docker Hub image: `azazellosaraksh/debugging-mtproto-bridge:latest`

### Access K8s
```bash
kube-dc login --domain kube-dc.cloud --org debugging
kube-dc use kube-dc.cloud/debugging/echovoice
```

### Deploy Commands
```bash
# Deploy Worker only
npm run deploy:worker

# Deploy Bridge (build + K8s restart)
npm run deploy:server

# Deploy everything
npm run deploy:all

# Manual K8s apply
kubectl apply -f kubernetes/whisper-messenger-env-secret.yaml
kubectl apply -f kubernetes/redis.yaml
kubectl apply -f kubernetes/mtproto-bridge/k8s.yaml
kubectl apply -f kubernetes/bridge-ingress.yaml
```

### Key Services & URLs
| Service | URL |
|---------|-----|
| Worker | https://voicemsg.net |
| Bridge Manager | http://mtproto-bridge-manager:3000 (internal) |
| Bridge Ingress | https://mtproto.voicemsg.net (if needed) |
| Qwen3-ASR | http://qwen3-asr:11434 |
| Redis | redis://redis:6379 |

---

## 🐛 Known Issues & Fixes

### Issue 1: QR Login with 2FA Broken
**Problem:** When user has 2FA enabled, QR login shows "2FA Password required" alert but no password input appears. Session hangs in `password_needed` state indefinitely.

**Root Cause:** `mtproto-bridge/src/auth.js:135-139` returns empty string `""` to password callback, which is invalid. Telegram rejects it silently.

**Fix Applied:** Changed password callback to return `null` and trigger proper error flow. Added 5-minute server timeout to auto-cleanup abandoned sessions. Disconnect client on password_needed status.

**Files Modified:**
- `mtproto-bridge/src/auth.js` (lines 135-142, 147-164)
- Added server-side timeout (5 min)

**Status:** ✅ Fixed

---

### Issue 2: Missing BRIDGE_SECRET in K8s Secret
**Problem:** `kubernetes/whisper-messenger-env-secret.yaml` did not contain `BRIDGE_SECRET`, but deployment referenced it via `secretKeyRef`. This would cause pod startup failure or empty secret value.

**Fix Applied:** Added `BRIDGE_SECRET: "ef13b022-d4fc-4dca-a439-cfaea972838c"` (value from deployed cluster) to the secret.

**Files Modified:**
- `kubernetes/whisper-messenger-env-secret.yaml` (line 8)

**Status:** ✅ Fixed

---

### Issue 3: Bridge API Calls No Timeout
**Problem:** Worker → Bridge manager fetch calls in `src/routes/auth.ts` have no timeout, can hang indefinitely if bridge is down.

**Fix Applied:** Wrapped all bridge fetch calls with AbortController (30s timeout).

**Files Modified:**
- `src/routes/auth.ts` (lines 419-536)

**Status:** ✅ Fixed

---

### Issue 4: QR Session Cleanup
**Problem:** Failed/abandoned QR sessions not removed from `authSessions` Map → memory leak.

**Fix Applied:** Added 5-minute TTL cleanup in `qrStart()` and ensured deletion on errors.

**Files Modified:**
- `mtproto-bridge/src/auth.js` (lines 128-140, 160-170)

**Status:** ✅ Fixed

---

### Issue 5: Namespace Inconsistency
**Problem:** Some K8s configs referenced `debugging-whispermsg`, actual cluster namespace is `debugging-echovoice`.

**Fix Applied:** Updated `mtproto-bridge/k8s.yaml` to use `debugging-echovoice` namespace in ServiceAccount, Role, RoleBinding.

**Files Modified:**
- `mtproto-bridge/k8s.yaml` (lines 4, 10, 28, 53)

**Status:** ✅ Fixed

---

## 🧪 Testing

### Health Checks
```bash
# Bridge Manager
curl https://mtproto.voicemsg.net/health
# Response: { "mode": "MANAGER", "alive": true, "userId": null }

# Worker
curl https://voicemsg.net/health  # (if health endpoint exists)
```

### QR Login Flow Test
1. Go to https://voicemsg.net/auth
2. Click "Connect with QR Code"
3. Scan QR with Telegram app
4. Wait for success redirect to `/dashboard`
5. Verify pod spawned: `kubectl get pods -n debugging-echovoice | grep tg-user-<userId>`

### Session Validation
```bash
# From worker
curl -X POST https://voicemsg.net/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'

# Should return { "success": true, "phoneCodeHash": "..." }
```

---

## 📊 Monitoring

### Pod Status
```bash
kubectl get pods -n debugging-echovoice -l app=tg-user-bridge
kubectl logs -f <pod-name> -n debugging-echovoice
```

### Bridge Manager Logs
```bash
kubectl logs -f deployment/mtproto-bridge-manager -n debugging-echovoice
```

### Error Logs in KV
- `last_errors` — recent errors (last 50)
- Access via Bridge `/kv/last_errors` endpoint or Redis CLI

### Metrics
- Transcription count stored in `user_meta_<userId>` → `transcriptionCount`
- Active users list: `users_list` key in KV

---

## 🔧 Configuration Reference

### Transcription Provider

| Provider | Env Var | URL | Notes |
|----------|---------|-----|-------|
| **Qwen3-ASR** | `OLLAMA_BASE_URL` | http://qwen3-asr:11434 | Sole transcription engine (Ollama-based) |

> Note: Sherpa ONNX (local) and Cloudflare AI providers have been removed. Only Qwen3-ASR is supported.

### Translation
- Enabled via user setting `translateTo` (language code or 'original')
- Uses Ollama at `OLLAMA_BASE_URL` (default: http://qwen3-asr:11434)
- Model: `OLLAMA_MODEL` (default: qwen3-coder:30b)
- 10s timeout, background fetch (non-blocking)

---

## 🗄️ Data Storage

### Redis Keys (KV Namespace)
| Key | Type | Description |
|-----|------|-------------|
| `user_meta_<userId>` | JSON | User profile, session, settings |
| `tg_session_<userId>` | String | Current Telegram session (TTL: 1y) |
| `users_list` | JSON array | All registered user IDs |
| `last_errors` | JSON array | Last 50 errors (circular buffer) |
| `email_verify_<token>` | String | Email verification token (TTL: 15min) |
| `rate_email_<email>` | String | Rate limit flag (TTL: 1min) |
| `meta_page_owner_<pageId>` | String | userId who owns FB page |
| `threads_owner_<threadsUserId>` | String | userId who owns Threads account |

### Session Format
```
Cookie: session=<base64url_hmac_sha256>
Format: userId.signatureHash
Signing key: SESSION_SECRET
Max-Age: 31536000 (1 year)
```

---

## 🔄 Reconciliation & Auto-Recovery

### Manager Reconciliation Loop
- Runs every **5 minutes** (`index.js:212`)
- Fetches active users from Worker `/internal/active-users`
- Compares with running pods (`listPods()`)
- Spawns missing pods automatically

**Purpose:** Auto-restart user pods after Worker restarts or pod failures.

### Access Checker (User Pods)
- Runs every **60 seconds** (`user.js:171`)
- Calls `Api.users.GetUsers` for TARGET_USER_ID
- If blocked/deactivated → notifies Manager `/internal/access-revoked`
- Manager deletes pod, user must re-auth

---

## 🛡️ Security

### Authentication
- **Worker → Bridge:** `x-bridge-secret` header or `?secret=` query param
- **Bridge Secret:** `BRIDGE_SECRET` env var (UUID format in prod)
- **Session Signing:** HMAC-SHA256 with `SESSION_SECRET`

### Rate Limiting
- Email verification: 1 per minute per email (`rate_email_<email>`)
- No rate limit on Telegram auth (assumes Cloudflare WAF layer)

### Secrets Management
- All secrets in K8s Secret `whisper-messenger-env` (base64-encoded)

---

## 🐛 Logging & Debugging

### Log Levels
- **Worker:** `console.log` (info), `console.error` (errors)
- **AI:** `console.log` (info), `console.error` (errors)

### Log Locations
1. **Bridge Manager:** `kubectl logs deployment/mtproto-bridge-manager -n debugging-echovoice`
2. **User Pod:** `kubectl logs <pod-name> -n debugging-echovoice`
4. **Redis:** `kubectl exec -it redis-<pod> -n debugging-echovoice -- redis-cli`

### Error Reporting
- Last 50 errors stored in KV `last_errors`
- Tagged with platform: `tg`, `meta`, `wa`, `line`,
- Accessible via `/admin` dashboard

### Debug Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/health` | Health check (returns mode + alive status) |
| `/env` | Dump environment vars (auth required) |
| `/test-tg` | Test Telegram connection with message |
| `/test-voice` | Test voice transcription flow |
| `/pods` | List all user pods |
| `/kv/<key>` | Get/set/delete Redis keys |

---

## 🚨 Troubleshooting

### "QR code expired" after scanning
- Check Bridge secret mismatch → verify `BRIDGE_SECRET` in secret = value in `index.js:auth()`
- Check Bridge Manager logs for `[/qr-check] No session` error
- Ensure no multiple scans → QR token is single-use

### User pod not starting
- Check `/spawn` endpoint: `kubectl logs deployment/mtproto-bridge-manager`
- Verify `TARGET_USER_ID` matches user ID format
- Check image pull: `azazellosaraksh/debugging-mtproto-bridge:latest`
- Verify Redis connectivity from pod

### Transcription failing
- Check user's `transcriptionCount` in KV (may be rate-limited in future)
- Verify Qwen3-ASR service is healthy: `curl http://qwen3-asr:11434/health`
- Review `transcribe.js` error logs

### Webhook not delivering
- Verify Meta/WhatsApp webhook URL points to voicemsg.net/webhook/
- Inspect Worker logs for incoming requests
- Ensure Cloudflare tunnel is active

---

## 📝 Development Workflow

### Local Development
```bash
# Worker dev server
npm run dev  # Uses Miniflare locally

# Bridge dev (requires K8s access)
# Edit files in mtproto-bridge/src/, then rebuild:
cd mtproto-bridge
bash build.sh  # Builds & pushes to Docker Hub
kubectl rollout restart deployment mtproto-bridge-manager -n debugging-echovoice
```

### Testing
```bash
# Unit tests (Vitest)
npm test

# Bridge tests
cd mtproto-bridge && npm test


### Code Style
- **TypeScript** strict mode (Worker)
- **CommonJS** (Bridge, legacy Node 16+)
- **Preact** for UI components
- **Hono** for Worker routing
- **4-space indentation**, no semicolons (Prettier default)

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.162 | 2026-05-05 | Fixed QR 2FA, added BRIDGE_SECRET to K8s secret, request timeouts, removed Sherpa ONNX (now only Qwen3-ASR) |
| 1.0.161 | — | Previous version |
| 1.0.0 | — | Initial release |

Version incremented on each `npm run deploy:*` via `npm version patch`.

---

## 📞 Support

- **Issues:** https://github.com/LeXuS-Azazello/whisper-messenger/issues
- **Documentation:** See AGENTS.md for Kilo CLI guidelines
- **Domain:** voicemsg.net (Cloudflare DNS + Tunnel)

---

## ⚡ Quick Reference: Critical Files

| File | Purpose | Lines of Note |
|------|---------|---------------|
| `mtproto-bridge/src/auth.js` | QR & phone auth | 119-188 (qrStart/qrCheck) |
| `src/routes/auth.ts` | Worker auth proxy | 500-536 (qr-start/qr-check handlers) |
| `src/dashboard_ui.tsx` | Dashboard QR UI | 815-886 (QR flow) |
| `mtproto-bridge/src/user.js` | Message handler | 22-148 (voice processing) |
| `mtproto-bridge/src/k8s.js` | Pod orchestration | 49-113 (spawnPod) |
| `kubernetes/whisper-messenger-env-secret.yaml` | All secrets | MUST include BRIDGE_SECRET |

---

**END OF PROJECT OVERVIEW**
