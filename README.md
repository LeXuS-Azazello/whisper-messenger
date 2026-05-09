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
│   │  (Hono + Preact)  │  │ Bridge   │  │ Qwen3-ASR   │             │
│   │  - Routes         │  │ Manager  │  │ (Ollama)    │             │
│   │  - Auth           │  │          │  │             │             │
│   │  - Dashboard      │  │  :3000   │  │  :11434     │             │
│   │  - Admin          │  │          │  │             │             │
│   │  - Webhooks       │  └────┬─────┘  └──────┬──────┘             │
│   │  - Bridge proxy   │       │                │                    │
│   └────────┬──────────┘       │                │                    │
│            │                  │                │                    │
│   ┌────────▼──────────┐  ┌────▼────────────────▼──────┐             │
│   │ K8s: Redis        │  │ K8s: User Pods (dynamic)    │             │
│   │ (Session store)   │  │  - telegram MTProto clients │             │
│   │  :6379            │  │  - spawned per user session  │             │
│   └───────────────────┘  └─────────────────────────────┘             │
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
- **Role**: Manages Telegram user sessions, spawns/terminates per-user bridge pods
- **Path**: `mtproto-bridge/index.js` — Express.js server
- **Image**: `azazellosaraksh/debugging-mtproto-bridge:v2`
- **Mode**: `MANAGER` (when `MODE=MANAGER` env var is set)
- **Endpoints**:
  - `/health` — Health check
  - `/send-code`, `/verify-code`, `/verify-password` — Telegram auth
  - `/qr-start`, `/qr-check` — QR code login flow
  - `/spawn` — Create user bridge pod
  - `/delete` — Terminate user bridge pod
  - `/pods` — List all active pods
  - `/test-tg` — Send test Telegram message
  - `/internal/active-users` — List active users (bridge secret required)
  - `/internal/config` — Get whisper config (bridge secret required)
- **Secrets needed**: `BRIDGE_SECRET`, `TELEGRAM_APP_HASH`, `WORKER_URL`, `REDIS_URL`

### 3. User Bridge Pods (Dynamic, per-user)
- **Role**: Maintain persistent MTProto connection for each Telegram user
- **Image**: Same as bridge manager (`azazellosaraksh/debugging-mtproto-bridge:v2`)
- **Mode**: `USER` (spawned dynamically by manager)
- **Network policy**: Can only reach Redis, Qwen3-ASR, and internet (ports 80/443)

### 4. Qwen3-ASR Transcription Service (Kubernetes)
- **Role**: Speech-to-text transcription using Qwen3-ASR model via Ollama
- **Path**: `src/whisper.ts` — calls `OLLAMA_BASE_URL/v1/audio/transcriptions`
- **Image**: `azazellosaraksh/debugging-qwen3-asr:latest`
- **Storage**: 50Gi persistent volume for model storage
- **Note**: Currently experiencing `ImagePullBackOff` — image may need to be rebuilt/pulled

### 5. Redis (Kubernetes)
- **Role**: Session storage, user metadata, stats, KV-like data store
- **Image**: `redis:7-alpine`
- **Port**: 6379 (ClusterIP)
- **StatefulSet** with 10Gi persistent volume

### 6. Ingress / TLS
- **Host**: `voicemsg.net`
- **TLS**: Let's Encrypt (`voicemsg-tls` secret)
- **Class**: nginx
- **Paths**: All paths (`/`) route to `echo-frontend` service on port 80

## Data Flow

### Telegram User Connection:
1. User visits `voicemsg.net` → Frontend serves landing page
2. User clicks "Connect Telegram" → QR code auth or phone number flow
3. Frontend calls bridge `/qr-start` or `/send-code` → bridge sends Telegram code
4. User verifies → bridge creates Telegram client session
5. Frontend calls `/spawn` → bridge manager creates user pod with session
6. User pod maintains persistent connection to Telegram servers
7. Voice messages received → bridge forwards to Frontend webhook
8. Frontend queues audio → Qwen3-ASR transcribes → result sent back via Telegram

### Webhook Processing:
1. Meta/WhatsApp sends webhook → Frontend verifies signature
2. Frontend forwards verified payload to bridge `/webhooks/meta` or `/webhooks/whatsapp`
3. Bridge queues audio job → Frontend picks up via `queue` consumer
4. Frontend calls Qwen3-ASR → gets transcription → sends reply

## Environment Variables (Secrets)

| Variable | Purpose | Example |
|----------|---------|---------|
| `WORKER_URL` | Public URL of the frontend server | `https://voicemsg.net` |
| `BRIDGE_URL` | Internal bridge URL (K8s service) | `http://mtproto-bridge-manager:3000` |
| `BRIDGE_SECRET` | Auth secret for bridge API | *(random)* |
| `SESSION_SECRET` | Secret for signing user sessions | *(random)* |
| `ADMIN_SECRET` | Admin panel password | *(random)* |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | *(from Google Cloud)* |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | *(from Google Cloud)* |
| `META_APP_ID` | Facebook App ID | *(from Meta Developers)* |
| `META_APP_SECRET` | Facebook App Secret | *(from Meta Developers)* |
| `META_PAGE_TOKEN` | Facebook Page Access Token | *(from Meta)* |
| `META_API_VERSION` | Meta Graph API version | `v21.0` |
| `VERIFY_TOKEN` | Webhook verify token | *(random)* |
| `TELEGRAM_APP_ID` | Telegram API app ID | `13867088` |
| `TELEGRAM_APP_HASH` | Telegram API app hash | *(from Telegram)* |
| `REDIS_URL` | Redis connection URL | `redis://redis:6379` |
| `OLLAMA_BASE_URL` | Qwen3-ASR/Ollama URL | `http://qwen3-asr:11434` |

## Project Structure

```
.
├── src/
│   ├── index.ts              # Main frontend entry (route dispatcher)
│   ├── types.ts              # TypeScript interfaces (includes ExecutionContext, MessageBatch)
│   ├── session.ts            # HMAC session signing/verification
│   ├── verify.ts             # Meta webhook signature verification
│   ├── queue.ts              # Audio job queue consumer
│   ├── whisper.ts            # Qwen3-ASR transcription
│   ├── logger.ts             # Error logging
│   ├── redisKV.ts            # Redis KV adapter
│   ├── telegram.ts           # Telegram bot API
│   ├── meta.ts               # Meta/Facebook Messenger API
│   ├── whatsapp.ts           # WhatsApp Cloud API
│   ├── line.ts               # LINE Messaging API
│   ├── server.ts             # Hono dev server (also production entry)
│   ├── routes/               # Route handlers
│   │   ├── auth.ts           # Authentication routes
│   │   ├── admin.ts          # Admin panel routes
│   │   ├── dashboard.ts      # User dashboard routes
│   │   ├── webhooks.ts       # Webhook handlers
│   │   └── internal.ts       # Internal bridge routes
│   └── components/           # Preact SSR components
│       ├── home/             # Landing page
│       ├── auth/             # Auth flow UI
│       ├── dashboard/        # User dashboard
│       └── admin/            # Admin panel
├── mtproto-bridge/           # Telegram MTProto bridge
│   ├── index.js              # Bridge Express server
│   ├── src/                  # Bridge modules
│   │   ├── config.js         # Configuration
│   │   ├── auth.js           # Telegram auth
│   │   ├── k8s.js            # Kubernetes pod management
│   │   ├── user.js           # User session/client
│   │   └── utils.js          # Utilities
│   └── Dockerfile            # Bridge container
├── kubernetes/
│   ├── base/                 # Base K8s manifests
│   │   ├── frontend.yaml     # Frontend Deployment + Service
│   │   ├── redis.yaml        # Redis StatefulSet + PVC + Service
│   │   └── kustomization.yaml
│   ├── overlays/
│   │   ├── testcrash-cloud/  # Test overlay
│   │   │   └── kustomization.yaml
│   │   └── voicemsg/         # Production overlay
│   │       └── kustomization.yaml
│   ├── k8s.yaml              # All-in-one manifest (non-Redis resources)
│   ├── frontend.yaml         # Frontend-only manifest
│   ├── ingress.yaml          # Ingress for voicemsg.net
│   ├── mtproto-bridge-manager.yaml  # Bridge manager
│   └── whisper-messenger-env-secret.yaml
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Deployment

### Prerequisites
- `kubectl` configured with access to the cluster
- Docker hub credentials for pushing images (if rebuilding bridge)

### Deploy to Kubernetes
```bash
# Login to cluster
kube-dc login --domain kube-dc.cloud --org debugging
kube-dc use kube-dc.cloud/debugging/testcrash-cloud

# Option A: Deploy with kustomize (recommended)
kubectl apply -k kubernetes/base/
kubectl apply -f kubernetes/frontend.yaml
kubectl apply -f kubernetes/mtproto-bridge-manager.yaml
kubectl apply -f kubernetes/ingress.yaml

# Option B: Deploy with scripts
bash scripts/kapply.sh

# Restart frontend after code changes
kubectl rollout restart deployment echo-frontend -n debugging-testcrash-cloud
```

### Local Development
```bash
# Start bridge locally (separate terminal)
cd mtproto-bridge && npm start

# Set env vars
export REDIS_URL=redis://localhost:6379
export BRIDGE_URL=http://localhost:16000
export BRIDGE_SECRET=my-secret
export WORKER_URL=http://localhost:3000
# ... set other required env vars

# Start frontend server
cd src && npx tsx server.ts
```