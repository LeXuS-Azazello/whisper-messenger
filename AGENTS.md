# Critical Deployment Rules
my domain is voicemsg.net 

**NEVER** run or test on localhost. All deployment must use remote server the Kubernetes server only.

## Kubernetes Access
```bash
# Login and configure kubectl
kube-dc login --domain kube-dc.cloud --org debugging

# Switch to project context
kube-dc use kube-dc.cloud/debugging/echovoice
```

## Cloudflare Access
**NEVER** use browser login for Cloudflare. Only use console:
```bash
wrangler login
```

---

# Repository Guidelines
Do not start local. Only use my kubernetes on my server and cloudflare for DNS or tunnel
Only use one domain "voicemsg.net" else kubernetes services use by internal IP

## Deployment Architecture
- **Cloudflare Workers**: Handle webhooks and UI (Preact).
- **Kubernetes Cluster**: Runs MTProto bridge and Whisper server.

## Project Structure & Module Organization
Echo Messenger is a multi-tenant voice-to-text bridge connecting Meta (FB/Insta), WhatsApp, and Telegram to Whisper AI.

- **Kubernetes Configs (`kubernetes/`)**: Infrastructure definitions for Whisper and ingress controllers.

## Build, Test, and Development Commands
### Root (Cloudflare Worker)
- **Deploy**: `npm run deploy:worker` (Increments version and deploys to Cloudflare)
- **Full Deploy**: `npm run deploy:all` (Worker + MTProto bridge)


## Coding Style & Naming Conventions
- **Language**: TypeScript (ESNext) with strict mode enabled.
- **UI Framework**: Preact with JSX (`jsxImportSource: preact`).
- **Testing**: onnly on remote server Vitest for both Worker and Bridge.
- **Naming**: CamelCase for functions/variables, PascalCase for components.

## Testing Guidelines
- Use **Vitest** for all new tests.
- Worker tests should mock Cloudflare KV and AI bindings using `miniflare`.

## Commit & Pull Request Guidelines
- Follow semantic versioning for releases (e.g., `1.0.15`).
- Use descriptive feature/fix messages: `feat: add <feature>` or `fix: handle <issue>`.
- Avoid non-descriptive messages like "ffffggg".
