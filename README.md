# Voice Messenger — Multi-Platform Voice-to-Text Bridge

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     voicemsg.net (HTTPS/TLS)                        │
│                   ┌─────────────────────────┐                       │
│                   │   Ingress Controller    │                       │
│                   │   (nginx, letsencrypt)  │                       │
│                   └───────────┬─────────────┘                       │
│                               │                                     │
│              ┌────────────────┼────────────────┐                    │
│              │                │                │                    │
│   ┌──────────▼───────┐  ┌────▼─────┐  ┌──────▼──────┐             │
│   │  K8s: Frontend   │  │ K8s:     │  │ K8s:        │             │
│   │  (Hono + Preact) │  │ Bridge   │  │ Qwen3-ASR   │             │
│   │  - Routes         │  │ Manager  │  │ (Ollama)    │             │
│   │  - Auth           │  │          │  │             │             │
│   │  - Dashboard      │  │  :3000   │  │  :11434     │             │
│   │  - Webhooks       │  │          │  │             │             │
│   │  - Bridge proxy   │  └────┬─────┘  └──────┬──────┘             │
│   └────────┬──────────┘       │                │                    │
│            │                  │                │                    │
│   ┌────────▼──────────┐  ┌────▼────────────────▼──────┐             │
│   │ K8s: Redis        │  │ K8s: tg-client PODs        │             │
│   │ (Session store)   │  │  - MTProto per-user client  │             │
│   │  :6379            │  │  - spawned per user session  │             │
│   └───────────────────┘  │  - voice → Qwen3-ASR       │             │
│                          │  - transcription + translate │             │
│                          │  - reply via Telegram API    │             │
│                          └─────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Frontend Server (Kubernetes)
- **Role**: Main entry point, request routing, auth handling, webhook verification
- **Path**: `src/index.ts` — route dispatcher
- **Server**: `src/server.ts` — Hono-based Node.js HTTP server (port 3000)
- **Routes**:
  - `/` — Home/Landing page (`renderHome`)
  - `/auth*` — Authentication (Google, Telegram login, email, sessions)
  - `/dashboard*` — User dashboard (connected services, settings)
  - `/admin*` — Admin panel (system monitoring, config, user management)
  - `/webhooks/meta` — Meta (FB/IG) webhook verification + forwarding
  - `/webhooks/whatsapp` — WhatsApp webhook verification + forwarding
  - `/webhooks/telegram` — Telegram bot webhook handling
  - `/webhooks/line/*` — LINE webhook verification + forwarding
  - `/webhooks/threads` — Meta Threads webhook handling
  - `/internal/*` — Internal bridge communication endpoints
  - `/spawn`, `/delete-pod` — Bridge API proxy for frontend JS
  - `/health` — Health check endpoint
- **Stack**: Preact (SSR via `preact-render-to-string`), Hono framework
- **Secrets needed**: `WORKER_URL`, `BRIDGE_URL`, `BRIDGE_SECRET`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `META_*`, `VERIFY_TOKEN`, etc.

### 2. MTProto Bridge Manager (Kubernetes)
- **Role**: Manages Telegram user sessions, spawns/terminates per-user tg-client PODs
- **Path**: `mtproto-bridge/index.js` — Express.js server (MANAGER mode only)
- **Mode**: `MODE=MANAGER`
- **Endpoints**:
  - `/health` — Health check
  - `/send-code`, `/verify-code`, `/verify-password` — Telegram auth
  - `/qr-start`, `/qr-check` — QR code login flow
  - `/spawn` — Create tg-client user POD
  - `/delete` — Terminate tg-client user POD
  - `/pods` — List all active tg-client PODs
  - `/test-tg` — Send test Telegram message
  - `/internal/active-users` — List active users (bridge secret required)
  - `/internal/config` — Get whisper config (bridge secret required)
- **Secrets needed**: `BRIDGE_SECRET`, `TELEGRAM_APP_HASH`, `WORKER_URL`, `REDIS_URL`

### 3. tg-client — Per-User Telegram Client (NEW)
- **Role**: Maintains persistent MTProto connection per user, listens for voice messages, transcribes via Qwen3-ASR
- **Path**: `tg-client/src/` — Standalone Node.js/Express process
- **Mode**: `MODE=USER` (spawned dynamically by bridge manager)
- **Behavior**:
  - Connects to Telegram MTProto API with user's session
  - Listens for incoming private voice messages
  - Downloads audio → sends to Qwen3-ASR → sends transcription back
  - Optionally translates transcription via Ollama
  - Reports stats back to Frontend
- **Port**: 3001
- **Secrets needed**: `TG_SESSION`, `TARGET_USER_ID`, `TG_API_ID`, `TG_API_HASH`, `WORKER_URL`, `BRIDGE_SECRET`, `REDIS_URL`, `OLLAMA_BASE_URL`
- **Network**: Can reach Redis, Qwen3-ASR, internet (443/80)

### 4. Qwen3-ASR Transcription Service (Kubernetes)
- **Role**: Speech-to-text transcription using Qwen3-ASR model via Ollama
- **Path**: `src/whisper.ts` — Frontend worker queue consumer; `tg-client/src/telegramClient.js` — tg-client direct transcription
- **Storage**: 50Gi persistent volume for model storage
- **Note**: Currently experiencing `ImagePullBackOff` — image may need to be rebuilt/pulled

### 5. Redis (Kubernetes)
- **Role**: Session storage, user metadata, stats, KV-like data store
- **Image**: `redis:7-alpine`
- **Port**: 6379 (ClusterIP)
- **Deployment**: 10Gi persistent volume

### 6. Ingress / TLS
- **Host**: `voicemsg.net`
- **TLS**: Let's Encrypt
- **Class**: nginx
- **Paths**: All paths (`/`) route to `echo-frontend` service on port 80

## Data Flow

### Telegram User Connection:
1. User visits `voicemsg.net` → Frontend serves landing page
2. User clicks "Connect Telegram" → QR code auth or phone number flow
3. Frontend calls bridge `/send-code` or `/qr-start` → bridge sends Telegram code
4. User verifies → bridge creates Telegram session string
5. Frontend calls `/spawn` → bridge manager creates tg-client POD with session
6. **tg-client POD** maintains persistent MTProto connection to Telegram servers
7. Voice messages received → tg-client downloads audio → transcribes via Qwen3-ASR → sends reply via Telegram API
8. Stats reported back to Frontend via `/internal/stats`

### Webhook Processing:
1. Meta/WhatsApp sends webhook → Frontend verifies signature
2. Frontend queues audio job → Frontend `queue` consumer picks it up
3. Frontend calls Qwen3-ASR → gets transcription → sends reply via platform API

## Project Structure

```
.
├── src/                          # Frontend (Cloudflare Worker)
│   ├── index.ts                  # Main entry / route dispatcher
│   ├── types.ts                  # TypeScript interfaces
│   ├── queue.ts                  # Audio job queue consumer
│   ├── whisper.ts                # Qwen3-ASR transcription (frontend side)
│   ├── telegram.ts               # Telegram Bot API (notifications)
│   ├── meta.ts                   # Meta/Facebook Messenger API
│   ├── whatsapp.ts               # WhatsApp Cloud API
│   ├── line.ts                   # LINE Messaging API
│   ├── server.ts                 # Hono dev server
│   ├── routes/                   # Route handlers
│   ├── controllers/              # Controller logic
│   └── components/               # Preact SSR components
│
├── mtproto-bridge/               # MTProto Bridge Manager
│   ├── index.js                  # Express.js server (MANAGER mode)
│   ├── src/
│   │   ├── config.js             # Configuration + Redis
│   │   ├── auth.js               # Telegram auth (send-code, verify, QR)
│   │   ├── k8s.js                # K8s pod orchestration (spawn/delete tg-client PODs)
│   │   └── utils.js              # Utilities (Telegram client factory, auth middleware)
│   └── package.json
│
├── tg-client/                    # NEW: Per-user Telegram client engine
│   ├── src/
│   │   ├── index.js              # Entry point (Express + user client init)
│   │   ├── telegramClient.js     # MTProto listener, voice → Qwen3-ASR pipeline
│   │   ├── config.js             # Config + Redis connection
│   │   └── utils.js              # Telegram client factory
│   └── package.json
│
├── kubernetes/
│   ├── base/                     # Kustomize base
│   │   ├── kustomization.yaml    # Base resources
│   │   ├── frontend.yaml         # Frontend Deployment + Service
│   │   ├── redis.yaml            # Redis StatefulSet + PVC + Service
│   │   ├── qwen3-asr.yaml        # Qwen3-ASR (Ollama) Deployment + Service + PVC
│   │   ├── mtproto-bridge-manager.yaml  # Bridge Manager + RBAC + ServiceAccount
│   │   ├── ingress.yaml          # Ingress rules for voicemsg.net
│   │   ├── ingress-nginx.yaml    # Ingress controller (nginx)
│   │   ├── network-policy.yaml   # NetworkPolicy for user pods
│   │   ├── tg-client.yaml        # tg-client POD ConfigMap template
│   │   └── rbac.yaml            # RBAC for bridge manager
│   ├── overlays/
│   │   ├── testcrash-cloud/
│   │   │   └── kustomization.yaml
│   │   └── voicemsg/
│   │       └── kustomization.yaml
│   ├── whisper-messenger-env-secret.yaml  # Opaque secret with all env vars
│   ├── cloudflared-tunnel.yaml            # Cloudflare tunnel deployment
│   ├── grafana.yaml                       # Grafana monitoring
│   ├── prometheus.yaml                    # Prometheus monitoring
│   ├── fluentd.yaml                       # Log collection
│   └── ...                                # (EIPs, FIPs, issuer, netcheck — not in base)
│
├── scripts/
│   ├── deploy.sh                  # Standard deployment script
│   └── deploy-with-tunnel.sh     # Full deployment with Cloudflare tunnel
│
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Deployment

### Prerequisites
- `kubectl` configured with access to the cluster
- Docker hub credentials for pushing images (if rebuilding bridge/tg-client)

### Deploy to Kubernetes
```bash
# Login to cluster
kube-dc login --domain kube-dc.cloud --org debugging
kube-dc use kube-dc.cloud/debugging/testcrash-cloud

# Option A: Deploy with kustomize (recommended)
kubectl apply -k kubernetes/base/ -n debugging-testcrash-cloud

# Option B: Deploy with scripts
bash scripts/deploy.sh

# Restart frontend after code changes
kubectl rollout restart deployment echo-frontend -n debugging-testcrash-cloud
```


### Local Development
```bash
# Start bridge manager locally (separate terminal)
cd mtproto-bridge && npm start

# Set env vars
export REDIS_URL=redis://localhost:6379
export BRIDGE_URL=http://localhost:3000
export BRIDGE_SECRET=my-secret
export WORKER_URL=http://localhost:3000
# ... set other required env vars

# Start frontend server
cd src && npx tsx server.ts

# Start tg-client locally (separate terminal, MODE=USER)
export MODE=USER
export TARGET_USER_ID=12345
export TG_SESSION=<your session string>
cd tg-client && npm start
```
