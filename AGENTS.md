# Critical Deployment Rules
my domain is voicemsg.net 
namespace: debugging-trash-cloud

**NEVER** run or test on localhost. All deployment must use remote server the Kubernetes server only.

## Kubernetes Access
```bash
# Login and configure kubectl
kube-dc login --domain kube-dc.cloud --org debugging

# Switch to project context
kube-dc use kube-dc.cloud/debugging/voicemsg
```

## Cloudflare Access
**NEVER** use browser login for Cloudflare. Only use console:
```bash
wrangler login
```

---

# Repository Guidelines
Do not start local. Only use my remote kubernetes on my server and cloudflare for DNS or tunnel
Only use one domain "voicemsg.net" else kubernetes services use by internal IP


## Qwen3-ASR Speach2text voice transcribe model
need to easy change mode from GPU to CPU (multiple CPU)
Docker
To make it easier to use our qwen-asr Python package, we provide a pre-built Docker image: qwenllm/qwen3-asr. You only need to install the GPU driver and download the model files to run the code. Please follow the NVIDIA Container Toolkit installation guide to ensure Docker can access your GPU. If you are in Mainland China and have trouble reaching Docker Hub, you may use a registry mirror to accelerate image pulls.

First, pull the image and start a container:

LOCAL_WORKDIR=/path/to/your/workspace
HOST_PORT=8000
CONTAINER_PORT=80
docker run --gpus all --name qwen3-asr \
    -v /var/run/docker.sock:/var/run/docker.sock -p $HOST_PORT:$CONTAINER_PORT \
    --mount type=bind,source=$LOCAL_WORKDIR,target=/data/shared/Qwen3-ASR \
    --shm-size=4gb \
    -it qwenllm/qwen3-asr:latest
After running the command, you will enter the container’s bash shell. Your local workspace (replace /path/to/your/workspace with the actual path) will be mounted inside the container at /data/shared/Qwen3-ASR. Port 8000 on the host is mapped to port 80 in the container, so you can access services running in the container via http://<host-ip>:8000. Note that services inside the container must bind to 0.0.0.0 (not 127.0.0.1) for port forwarding to work.


## Deployment Architecture
- **Kubernetes Cluster**: Runs MTProto bridge and Whisper server.

## Project Structure & Module Organization
Voice Messenger is a multi-tenant voice-to-text bridge connecting Meta (FB/Insta), WhatsApp, and Telegram to  Qwen3-ASR.

- **Kubernetes Configs (`kubernetes/`)**: Infrastructure definitions ingress controllers.



## Coding Style & Naming Conventions
- **Language**: TypeScript (ESNext) with strict mode enabled.
- **UI Framework**: Preact with JSX (`jsxImportSource: preact`).
- **Testing**: onnly on remote server Vitest for both Worker and Bridge.
- **Naming**: CamelCase for functions/variables, PascalCase for components.

## Testing Guidelines
- Use **Vitest** for all new tests.


## Commit & Pull Request Guidelines
- Follow semantic versioning for releases (e.g., `1.0.15`).
- Use descriptive feature/fix messages: `feat: add <feature>` or `fix: handle <issue>`.
- Avoid non-descriptive messages like "ffffggg".
