# Repository Guidelines

## Project Structure & Module Organization
Echo Messenger is a multi-tenant voice-to-text bridge connecting Meta (FB/Insta), WhatsApp, and Telegram to Whisper AI.

- **Cloudflare Worker (`src/`)**: Main entry point handling webhooks, Preact-based UI (Admin/User dashboards), and orchestration.
- **MTProto Bridge (`mtproto-bridge/`)**: Node.js service in Kubernetes using GramJS for personal Telegram account access.
- **Whisper Server (`whisper-server/`)**: Python FastAPI server running Sherpa ONNX for high-performance audio transcription.
- **Kubernetes Configs (`kubernetes/`)**: Infrastructure definitions for Whisper and ingress controllers.

## Build, Test, and Development Commands
### Root (Cloudflare Worker)
- **Dev**: `npm run dev` (Wrangler local dev)
- **Test**: `npm run test` (Vitest unit tests)
- **Deploy**: `npm run deploy:worker` (Increments version and deploys to Cloudflare)
- **Full Deploy**: `npm run deploy:all` (Worker + MTProto bridge)

### MTProto Bridge
- **Dev**: `npm run dev` in `mtproto-bridge/`
- **Test**: `npm run test` in `mtproto-bridge/`
- **Build/Push**: `./build.sh` (Updates Docker image)

## Coding Style & Naming Conventions
- **Language**: TypeScript (ESNext) with strict mode enabled.
- **UI Framework**: Preact with JSX (`jsxImportSource: preact`).
- **Testing**: Vitest for both Worker and Bridge.
- **Naming**: CamelCase for functions/variables, PascalCase for components.

## Testing Guidelines
- Use **Vitest** for all new tests.
- Worker tests should mock Cloudflare KV and AI bindings using `miniflare`.
- Bridge tests use `supertest` for API endpoint verification.

## Commit & Pull Request Guidelines
- Follow semantic versioning for releases (e.g., `1.0.15`).
- Use descriptive feature/fix messages: `feat: add <feature>` or `fix: handle <issue>`.
- Avoid non-descriptive messages like "ffffggg".
