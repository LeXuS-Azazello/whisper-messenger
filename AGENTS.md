# Critical Deployment Rules
my domain is voicemsg.net 
namespace: debugging-testcrash-pub

## Recent Updates (May 2026)
- **FunASR 1.3.9**: Updated ASR service to version 1.3.9 with AutoModel support for VAD, punctuation, and auto-language detection. Fixed `UnboundLocalError` in tokenizer initialization by importing `AutoTokenizer` from `funasr.tokenizer`.


## Kubernetes Access
```bash
# Login and configure kubectl
kube-dc login --domain kube-dc.cloud --org debugging

# Switch to project context
kube-dc use kube-dc.cloud/debugging/testcrash-pub
```


# Repository Guidelines
- **ALL BUILDS AND DEPLOYMENTS ARE AUTOMATED:** Do not build *anything* on the local machine. Forgejo CI/CD handles all Docker builds, pushes, and Kubernetes rollouts automatically upon pushing to the `main` branch.
- **Local disk space is highly limited**, which is why local builds are strictly forbidden.
- Only use my remote Kubernetes on my server.
- Only use one domain "voicemsg.net" else kubernetes services use by internal IP.



## Project Structure & Module Organization
Voice Messenger is a multi-tenant voice-to-text connecting Meta (FB/Insta), WhatsApp, and Telegram to FunASR (MLT-Nano).

- **Kubernetes Configs (`kubernetes/`)**: Infrastructure definitions ingress controllers.



## Coding Style & Naming Conventions
- **Language**: TypeScript (ESNext) with strict mode enabled.
- **UI Framework**: Preact with JSX (`jsxImportSource: preact`).

- **Naming**: CamelCase for functions/variables, PascalCase for components.

## Testing Guidelines
- Use **Vitest** for all new tests.


## Commit & Pull Request Guidelines
- Follow semantic versioning for releases (e.g., `1.0.15`).
- Use descriptive feature/fix messages: `feat: add <feature>` or `fix: handle <issue>`.
- Avoid non-descriptive messages like "ffffggg".
