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
*   **Secure Routing**: Kubernetes Ingress integration for secure communication between worker and the internal K8s cluster.

---

## 🏗️ Architecture Overview

The system consists of three primary components:

1.  **Node.js Frontend (`/src`)**:
    *   Runs on Kubernetes (Node.js/Hono server).
    *   Handles all webhooks (Meta, WhatsApp, Telegram Bot).
    *   Renders Admin and User dashboards.
    *   Manages user stats and credentials in **Redis** (via `RedisKV`).
    *   Orchestrates transcription via Local Whisper Server or Ollama.
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
*   `SESSION_SECRET`: Key for signing user session cookies (standard HMAC-SHA256).
*   `BRIDGE_URL`: Public endpoint for the MTProto Manager.
*   `WHISPER_PROVIDER`: `qwen3-asr` (default), `cloudflare`, `local`, or `ollama`.
*   `LOCAL_WHISPER_URL`: Public endpoint for the Whisper-ONNX server.
*   `LOCAL_WHISPER_SECRET`: Shared secret for Whisper server authentication.
*   `GOOGLE_CLIENT_ID`: OAuth client ID for the landing page.

---

## 🛠️ Deployment (Redeploying to a new Host)

> **Note on AI Models:** The Whisper ONNX models are downloaded by the `whisper-server/entrypoint.sh` script into the `/app/models` directory when the pod first starts up. The MTProto bridge uses the external Whisper server for transcription and does not download or store models locally.

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

### 4. Kubernetes Ingress
1.  Ensure an Ingress Controller (e.g., NGINX) is installed on the cluster.
2.  Configure DNS A/AAAA records to point to your Ingress LoadBalancer IP:
    *   `mtproto.your-domain.com`
    *   `whisper-onnx.your-domain.com`

### 5. System Tuning (UDP Buffer)
If QUIC logs show `failed to sufficiently increase receive buffer size`:
- Increase UDP buffer sizes: `sysctl -w net.core.rmem_max=67108864 net.core.wmem_max=67108864`
- Increase file descriptors: `ulimit -n 1048576`
- Check current limits: `cat /proc/sys/net/core/rmem_max`

---

## 🛡️ Infrastructure Management (Kube-DC)

The cluster and resource management are handled via **Kube-DC** CLI.

### Authentication
```bash
kube-dc login --domain kube-dc.cloud --org debugging
```

### Resource Optimization
To manage costs, the worker pool is manually scaled as needed:
- **Scaling Workers**:
  ```bash
  kubectl patch md whispermsg-workers -n debugging-whispermsg --type='merge' -p '{"spec":{"replicas":1}}'
  ```
- **IP Cleanup**: Orphan Floating IPs (FIPs) from terminated VMs should be removed manually to free up Public IPs.

---

## 🔐 Security

*   Internal communication between Worker and Bridge is protected by a shared `BRIDGE_SECRET`.
*   User Telegram sessions are stored securely in Cloudflare KV and only accessible to dedicated pods.
*   All webhooks are verified and signed by respectuve platforms.

---

## 📄 License
Internal / Proprietary. Developed for Whisper Messenger Project.
