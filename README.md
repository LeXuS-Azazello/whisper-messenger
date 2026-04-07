# 🎙️ Whisper Messenger: Multi-Tenant Voice-to-Text Bridge

A high-performance, scalable solution to transcribe voice messages from **Telegram**, **WhatsApp**, **Instagram**, and **Facebook Messenger** into text using OpenAI Whisper AI, deployed on **Cloudflare Workers** and **Kubernetes**.

---

## 🚀 Key Features

*   **Hybrid Whisper AI Integration**: Toggle between **Cloudflare Workers AI** and a self-hosted **Sherpa ONNX** Whisper server on Kubernetes.
*   **MTProto Bridge Engine**: Dedicated Kubernetes pods for each user to provide isolated, high-performance Telegram client access using GramJS.
*   **Shared Transcription Service**: Centralized Whisper-ONNX server reduces RAM usage across user pods by handling all audio processing in one dedicated deployment.
*   **Scalable Orchestration**: A custom "Manager" service handles dynamic pod spawning and lifecycle management via the Kubernetes API.
*   **Whitelabeled SaaS Architecture**:
    *   **Google OAuth Landing Page**: Beautiful, modern entrance for users.
    *   **Personal User Dashboard**: Users can manage their own connected platforms and settings.
    *   **Admin Control Panel**: Full system visibility, statistics, and real-time Whisper provider toggling.
*   **Secure Routing**: Cloudflare Tunnel integration for secure communication between worker and the internal K8s cluster.

---

## 🏗️ Architecture Overview

The system consists of three primary components:

1.  **Cloudflare Worker (`/src`)**:
    *   Handles all webhooks (Meta, WhatsApp, Telegram Bot).
    *   Renders Admin and User dashboards.
    *   Manages user stats and credentials in **Cloudflare KV**.
    *   Orchestrates transcription via Cloudflare AI or the Local Whisper Server.
2.  **Shared Whisper Server (`/whisper-server`)**:
    *   FastAPI-based server running **Sherpa ONNX** with `whisper-tiny` model.
    *   Pre-instantiated model for high-speed transcription.
    *   Serves both the Cloudflare Worker and individual User Pods.
3.  **MTProto Bridge Manager (`/mtproto-bridge`)**:
    *   Runs in a Kubernetes cluster.
    *   Handles initial MTProto authentication (QR-code, Phone code).
    *   Spawns dedicated "User Pods" (`tg-user-bridge`) for persistent message listening.

---

## ⚙️ Configuration

### Environment Variables (`wrangler.toml` & `.env`)

*   `KV_NAMESPACE`: Access to the `STATS` storage.
*   `ADMIN_SECRET`: Password for the admin dashboard.
*   `BRIDGE_URL`: Public endpoint for the MTProto Manager.
*   `WHISPER_PROVIDER`: `cloudflare` (default) or `local`.
*   `LOCAL_WHISPER_URL`: Public endpoint for the Whisper-ONNX server.
*   `LOCAL_WHISPER_SECRET`: Shared secret for Whisper server authentication.
*   `GOOGLE_CLIENT_ID`: OAuth client ID for the landing page.

---

## 🛠️ Deployment (Redeploying to a new Host)

> **Note on AI Models:** The Whisper and Paraformer ONNX models are **not** stored in this repository and are **not** baked into the Docker images to keep the images lightweight and CI/CD fast. The models will be automatically downloaded by the `entrypoint.sh` scripts into the `/app/models` directories when the pods first start up.

### 1. Cloudflare Worker
```bash
npm install
npx wrangler deploy
```

### 2. Whisper ONNX Server (Kubernetes)
```bash
# 1. Build and push
cd whisper-server
./build.sh # Updates azazellosaraksh/debugging-whisper-onnx:latest

# 2. Deploy to K8s
kubectl apply -f ../kubernetes/whisper-onnx/whisper-k8s.yaml
```

### 3. MTProto Bridge (Kubernetes)
```bash
# 1. Build and push
cd mtproto-bridge
./build.sh # Updates azazellosaraksh/debugging-mtproto-bridge:latest

# 2. Deploy Manager
kubectl apply -f k8s.yaml
```

### 4. Cloudflare Tunnel
1.  Install `cloudflared` on the cluster or use the provided `mtproto-bridge/cloudflared.yaml`.
2.  Add Public Hostnames in Cloudflare Zero Trust Dashboard:
    *   `mtproto.your-domain.com` -> `http://mtproto-bridge-manager:3000`
    *   `whisper-onnx.your-domain.com` -> `http://whisper-onnx:8000`

---

## 🔐 Security

*   Internal communication between Worker and Bridge is protected by a shared `BRIDGE_SECRET`.
*   User Telegram sessions are stored securely in Cloudflare KV and only accessible to dedicated pods.
*   All webhooks are verified and signed by respectuve platforms.

---

## 📄 License
Internal / Proprietary. Developed for Whisper Messenger Project.
