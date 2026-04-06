# 🎙️ Whisper Messenger: Multi-Tenant Voice-to-Text Bridge

A high-performance, scalable solution to transcribe voice messages from **Telegram**, **WhatsApp**, **Instagram**, and **Facebook Messenger** into text using OpenAI Whisper AI, deployed on **Cloudflare Workers** and **Kubernetes**.

---

## 🚀 Key Features

*   **Multi-Platform Integration**: Transcribe voice messages from personal accounts across all major messaging platforms.
*   **MTProto Bridge Engine**: Dedicated Kubernetes pods for each user to provide isolated, high-performance Telegram client access using GramJS.
*   **Scalable Orchestration**: A custom "Manager" service handles dynamic pod spawning and lifecycle management via the Kubernetes API.
*   **Whitelabeled SaaS Architecture**:
    *   **Google OAuth Landing Page**: Beautiful, modern entrance for users.
    *   **Personal User Dashboard**: Users can manage their own connected platforms and settings.
    *   **Admin Control Panel**: Full system visibility, statistics, and pod management.
*   **Secure Routing**: Cloudflare Tunnel integration for secure communication between worker and the internal K8s cluster.
*   **Edge Processing**: Orchestrated by Cloudflare Workers for global performance and low latency.

---

## 🏗️ Architecture Overview

The system consists of two primary components:

1.  **Cloudflare Worker (`/src`)**:
    *   Handles all webhooks (Meta, WhatsApp, Telegram Bot).
    *   Renders Admin and User dashboards (Preact).
    *   Manages user stats and credentials in **Cloudflare KV**.
    *   Sends background transcription jobs to the bridge pods.
2.  **MTProto Bridge Manager (`/mtproto-bridge`)**:
    *   Runs in a Kubernetes cluster.
    *   Handles initial MTProto authentication (QR-code, Phone code).
    *   Spawns dedicated "User Pods" (`tg-user-bridge`) for persistent message listening.
    *   Performs local transcription (optional) or interacts with external Whisper APIs.

---

## ⚙️ Configuration

### Environment Variables (`wrangler.toml` & `.env`)

*   `KV_NAMESPACE`: Access to the `STATS` storage.
*   `ADMIN_SECRET`: Password for the admin dashboard.
*   `BRIDGE_URL`: Public endpoint for the MTProto Manager (protected by `BRIDGE_SECRET`).
*   `GOOGLE_CLIENT_ID`: OAuth client ID for the landing page.
*   `META_PAGE_TOKEN`: Global fallback token (optional).
*   `WHATSAPP_TOKEN`: Global fallback token (optional).

---

## 🛠️ Deployment

### 1. Cloudflare Worker
```bash
# Install dependencies
npm install

# Deploy to Cloudflare
npx wrangler deploy
```

### 2. MTProto Bridge (Kubernetes)
```bash
# Build and push the Docker image
cd mtproto-bridge
docker build -t your-repo/whisper-bridge:latest .
docker push your-repo/whisper-bridge:latest

# Update deployment (example)
kubectl rollout restart deployment mtproto-bridge-manager -n your-namespace
```

---

## 🔐 Security

*   Internal communication between Worker and Bridge is protected by a shared `BRIDGE_SECRET`.
*   User Telegram sessions are stored securely in Cloudflare KV and only accessible to dedicated pods.
*   All webhooks are verified and signed by respectuve platforms.

---

## 📄 License
Internal / Proprietary. Developed for Whisper Messenger Project.
