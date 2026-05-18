# 🎙️ Voice Messenger

> **The ultimate multi-platform voice-to-text bridge connecting Meta (FB/Insta), WhatsApp, LINE, and Telegram to state-of-the-art ASR (Whisper large-v3-turbo).**

[![Architecture](https://img.shields.io/badge/Architecture-Kubernetes--Native-blue?style=for-the-badge&logo=kubernetes)]()
[![Backend](https://img.shields.io/badge/Stack-Node.js%20%7C%20TypeScript%20%7C%20Hono-green?style=for-the-badge&logo=node.js)]()
[![AI](https://img.shields.io/badge/AI-Whisper%20Turbo-orange?style=for-the-badge&logo=openai)]()

---

## 🚀 Overview

Voice Messenger is a robust, multi-tenant system designed to transcribe voice messages across all major messaging platforms. It features a unique **per-user client architecture** for Telegram, ensuring persistent, low-latency monitoring of personal chats while providing a centralized dashboard for management.

### 🌟 Supported Platforms
- **Meta**: 🟦 Facebook Messenger & 🟪 Instagram
- **WhatsApp**: 🟩 WhatsApp Cloud API
- **Telegram**: 🛩️ Personal client Accounts (tdlib)  and telegram manager 
- **LINE**: 🟢 Messaging API
- **Threads**: 🪡 Meta Threads

---

## 🏗️ Architecture

```mermaid
graph TD
    User((User)) -->|HTTPS| Ingress[NGINX Ingress]
    Ingress -->|/| Frontend[Frontend Server / Hono]
    Frontend -->|Session| Redis[(Redis / Stats & Session)]
    
    Frontend -->|Internal API| BridgeMgr[Bridge Manager]
    BridgeMgr -->|Orchestration| K8s[Kubernetes API]
    K8s -->|Spawn| TGClient[tg-client Pods / Per-User]
    
    TGClient -->|Voice Data| ASR[]
    Frontend -->|Webhook Data| ASR
    
    TGClient -->|Transcription| Telegram((Telegram tdlib))
    Frontend -->|Reply| PlatformAPIs((Messenger / WhatsApp / etc.))
```

### 🧱 Core Components

1.  **Frontend Server** (`src/`):
    *   Hono-based Node.js server serving as the primary entry point.
    *   Handles **Webhooks**, **User Authentication** (Google/Email), and the **Dashboard**.
    *   Proxies bridge commands and serves Preact-rendered UI.
2.  **Client Manager** (`tg-client-manager/`):
    *   A specialized Kubernetes controller that manages the lifecycle of `tg-client` pods.
    *   Handles Telegram authentication flows (Phone/QR) and pod orchestration.
3.  **tg-client** (`tg-client/`):
    *   Persistent tdlib clients spawned **on-demand** for each Telegram user.
    *   Listen for voice messages in real-time and process them via the AI pipeline.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | TypeScript, Node.js, Hono, Express |
| **Frontend** | Preact, SSR, Vanilla CSS (Premium Aesthetics) |
| **Database** | Redis (Queue/Stats), MongoDB (Persistence) |
| **AI/ASR** | Whisper Turbo |
| **Infrastructure** | Kubernetes (Kustomize), Docker |
| **Monitoring** | Prometheus, Grafana, Fluentd |
| **Ingress** | NGINX |

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

| Service | Endpoint | Role |
| :--- | :--- | :--- |
| **Frontend** | `https://voicemsg.net` | Main Dashboard & Landing |
| **Client Manager** | `http://tg-client-manager:3000` *(Internal)* | Manager Logic |
| **AI API** | `http://whisper-turbo:8000` *(Internal)* | Whisper Turbo Access |

---

## 📂 Project Structure

```text
.
├── src/                    # Frontend & Webhook logic
│   ├── components/         # Preact UI components
│   ├── controllers/        # Business logic
│   ├── routes/             # API & Webhook routing
│   └── index.ts            # Entry point
├── tg-client-manager/      # Client Manager (K8s Orchestrator)
├── tg-client/              # Per-user Telegram engine
├── kubernetes/             # Infrastructure definitions
│   ├── base/               # Kustomize base resources
│   └── overlays/           # Environment-specific configs
└── scripts/                # Deployment & utility scripts
```

---

## 🛡️ Security & Privacy
*   **Dual-Factor Verification**: Requests between Frontend and Bridge are signed with a shared `BRIDGE_SECRET`.
*   **Internal Network Isolation**: `whisper-turbo` (AI engine) and `tg-client-manager` are strictly exposed **only via internal Kubernetes ClusterIP**. They are not accessible from the public internet.
*   **Per-User Pod Isolation**: User-specific `tg-client` pods are strictly isolated within the cluster.
*   **Self-Destruct Logic**: If a user revokes Telegram access, the `tg-client` pod intercepts the authorization failure, gracefully clears the user session in the MongoDB/Redis backend, and automatically triggers its own deletion to preserve cluster resources.
*   **Zero-Storage Policy**: Audio files and transcribed text are processed purely in RAM buffers and never saved to persistence storage.

---

*Built with ❤️ for advanced agentic coding by the Voice Messenger Team.*



213.111.155.16 Proxied
voicemsg.net 213.111.154.233
