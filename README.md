# 🎙️ Voice Messenger

> **Multi-tenant voice-to-text platform connecting Telegram, WhatsApp (Baileys), Facebook Messenger (FCA), and Instagram (FCA) to high-quality offline ASR via FunASR (Fun-ASR-Nano или Fun-ASR-MLT-Nano) and TTS via Samesame (CosyVoice 3.0).**

## 📢 Recent Changes (May 2026)
- Switched `samesame` Docker base image to `python:3.10‑slim` and removed Miniconda, fixing build errors.
- Updated `samesame` to use **FunAudioLLM/CosyVoice3-0** (CPU‑optimized) instead of XTTS.
- Adjusted resource requests for `samesame` (CPU 1 → 1.5, RAM 4 Gi → 8 Gi) to fit namespace quotas.
- All services now start cleanly; `samesame` reports **Model ready** and health checks return `200 OK`.



---

## 🚀 Overview

Voice Messenger is a multi-tenant system that automatically transcribes voice messages from personal chats on major messaging platforms. 

It uses a **per-user Kubernetes pod architecture**: for every connected account (Telegram, WhatsApp, Facebook, Instagram) the system spawns a dedicated lightweight client pod that runs 24/7 and forwards voice messages to the central ASR service.

### 🌟 Currently Supported Platforms
- **Telegram** — personal accounts via tdlib (per-user pods)
- **WhatsApp** — personal accounts via Baileys (per-user pods, 3 connection methods: QR, Phone Pairing, wa.me)
- **Facebook Messenger** — personal accounts via FCA (per-user pods)
- **Instagram** — Direct messages via FCA (per-user pods)

**ASR backend**: Fun-ASR-Nano или Fun-ASR-MLT-Nano, (Russian, Hebrew, Arabic, Thai, many langs).

---

## 🏗️ Architecture

The system follows a **per-user pod** model:

- Every connected messenger account (Telegram, WhatsApp, FB, IG) gets its own dedicated Kubernetes pod running the client library (tdlib or Baileys/FCA).
- These pods are created and supervised by the corresponding **manager** (tg-client-manager, whatsapp-baileys-manager, facebook-fca-manager, instagram-fca-manager).
- Voice messages are sent to **FunASR-Nano** (API + BullMQ worker) for transcription.
- Results are delivered back to the user via the original platform or the web dashboard.


### 🧱 Core Components

| Component                    | Purpose                                      | Per-user pods? |
|-----------------------------|----------------------------------------------|----------------|
| `src/` (Frontend + Hono)    | Web dashboard, auth, webhooks, UI            | No             |
| `*-manager/` (4 managers)   | Kubernetes controllers that spawn & manage per-user client pods | No (shared) |
| `*-client/` folders         | Actual messenger clients (tdlib, Baileys, FCA) running inside user pods | Yes |
| `funasr`                    | ASR service (FunASR-MLT-Nano)    | Shared |
| `samesame`                  | Premium voice cloning (FunAudioLLM/CosyVoice3-0.5B + CPU optimized)     | Shared |
| `kubernetes/`               | Kustomize manifests for all services         | —              |

---

## 🛠️ Technology Stack

| Layer          | Technologies                                      |
|----------------|---------------------------------------------------|
| **Backend**    | TypeScript, Node.js, Hono                         |
| **Frontend**   | Preact + TSX (modern dashboard with per-messenger cards) |
| **Database**   | Redis (BullMQ queues, sessions, user settings), MongoDB |
| **ASR & TTS**  | funasr (Fun-ASR-MLT-Nano) & samesame (CosyVoice 3.0) |
| **Infrastructure** | Kubernetes + Kustomize, Docker, Harbor registry |
| **Deployment** | `npm run deploy:k8s` (builds + pushes + updates images) |

---

## 🚦 Getting Started

### Prerequisites
*   A Kubernetes cluster with `kubectl` configured.
*   `kube-dc` CLI for cluster access.
*   Redis instance reachable within the cluster.

### Deployment
The project uses a streamlined deployment script that builds the images, pushes them to the private Harbor registry (`harbor.dev.takatan.cloud`), and updates the Kubernetes manifests.

```bash
# Deploy to the production namespace
npm run deploy:k8s
```

## 🔌 System Endpoints

| Service                  | Endpoint (internal)                                      | Role |
|--------------------------|----------------------------------------------------------|------|
| **Frontend**             | `https://voicemsg.net`                                   | Main dashboard & landing |
| **funasr**               | `http://funasr:50001`                                    | ASR API (transcribe-base64) |
| **samesame**             | `http://samesame:8002`                                   | Premium voice cloning (CosyVoice3.0) (`/v1/clone`) |
| **Managers**             | tg-client-manager:3000, whatsapp-baileys-manager:3002, facebook-fca-manager:3003, instagram-fca-manager:3005 | Per-user pod orchestration |

---

## 📦 WhatsApp Integration

**Production stack**: `whatsapp-baileys-manager` + `whatsapp-baileys-client` (Baileys library).

- Runs as per-user pods
- Supports three connection methods in the dashboard: QR code, Phone Pairing Code, Direct wa.me link
- Legacy `whatsapp-client*` (whatsapp-web.js) folders are deprecated and are being removed

> Rule: Only `whatsapp-baileys-*` is actively maintained.

---

## 📂 Project Structure

```text
.
├── src/                              # Preact dashboard + Hono backend
│   └── components/dashboard/         # ConnectionsPane + per-messenger cards
├── tg-client-manager/                # Spawns & manages per-user Telegram pods (see README)
├── tg-client/                        # tdlib client (runs inside user pods) (see README)
├── whatsapp-baileys-manager/         # WhatsApp (Baileys) manager
├── whatsapp-baileys-client/          # Baileys client (per-user pods)
├── facebook-fca-manager/             # Facebook Messenger (FCA)
├── facebook-fca-client/
├── instagram-fca-manager/            # Instagram Direct (FCA)
├── instagram-fca-client/
├── funasr/                           # ASR (API + Fun-ASR-Nano или Fun-ASR-MLT-Nano)
├── samesame/                         # Premium voice cloning (CosyVoice3.0 + CPU optimized) (see README)
├── kubernetes/                       # Kustomize manifests (base + overlays) (see README)
└── scripts/deploy.sh                 # Full build + push + rollout + auto model downloaders
```

### 📚 Detailed Documentation
*   [**Kubernetes Manifests & Architecture**](kubernetes/README.md)
*   [**SAMESAME Voice Cloning**](samesame/README.md)
*   [**Telegram Client**](tg-client/README.md)
*   [**Telegram Client Manager**](tg-client-manager/README.md)

---

## 🛡️ Key Design Decisions

- **Per-user isolation** — every account runs in its own Kubernetes pod (no shared sessions).
- **Zero persistent audio** — voice messages are processed in memory only.
- **FunASR-Nano** — stable ASR under load (Russian, Hebrew, Arabic, Thai, many langs).
- **Modern dashboard** — clean Preact UI with dedicated connection cards for each messenger.

---

*Updated 2026-05 — FunASR-Nano + samesame (voice cloning via CosyVoice 3.0 with CPU multi-threading).* 
