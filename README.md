# Voice Messenger

Voice Messenger is a multi-tenant voice-to-text platform connecting Meta (Facebook/Instagram), WhatsApp, and Telegram to FunASR (MLT-Nano) and CosyVoice3.

## Deployment & CI/CD

**⚠️ ALL BUILDS AND DEPLOYMENTS ARE FULLY AUTOMATED! ⚠️**

Do **NOT** build or deploy anything on your local machine.

This project is integrated with **Forgejo Actions**. Every time you push code to the `main` branch, the Forgejo CI/CD pipeline automatically:
1. Builds the Docker images using the private `forge.dev.takatan.cloud` registry.
2. Pushes the latest image tags.
3. Authenticates to the Kubernetes cluster using `kube-dc`.
4. Executes a rolling restart (`kubectl rollout restart` or `kubectl delete pod`) to seamlessly pull the new images into production.

## Services

- **echo-frontend**: Web UI
- **funasr**: ASR Speech-to-Text
- **samesame**: TTS CosyVoice3 Voice Cloning
- **tg-client-manager**: Telegram lifecycle manager
- **whatsapp-baileys-manager**: WhatsApp lifecycle manager
- **facebook-fca-manager**: Facebook lifecycle manager
- **instagram-fca-manager**: Instagram lifecycle manager

### Shared Media Storage Architecture
To eliminate memory overhead and speed up inference, `tg-client`, `whatsapp-baileys-client`, `samesame`, and `funasr` share a `1Gi` Kubernetes PersistentVolumeClaim (`temporaly-media-msg`). 
- Messengers download audio and write it to `/temporaly-media-msg`.
- Services pass the `file_path` (`source_audio_path` / `file_path`) over HTTP instead of inflating payloads with Base64.
- `funasr` reads the audio via OS page cache and processes it natively via `ffmpeg` subprocess.
- Telegram client automatically cleans up the shared volume files (`fs.unlinkSync` and `deleteFile` TDLib API) to keep it under 1GB.

## Local Environment

Since all heavy-lifting is done remotely:
- Do not run local Docker builds for heavy ML services.
- Database (`mongodb`) and caching (`redis`) run in the remote cluster.
- Connect using `voicemsg.net` or `kube-dc` to access internal services.
