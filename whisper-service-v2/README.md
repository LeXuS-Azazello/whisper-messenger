# whisper-service-v2

Fast CPU-only ASR service for voice messages using:
- `sherpa-onnx` SenseVoice INT8
- `Silero VAD`
- Simple offline punctuation for 100+ languages (CT-Transformer optional for zh/en)
- `BullMQ` + Redis task queue
- Redis SHA256 cache
- optional `NLLB-200` translation service

## Run locally

1. Install dependencies:

```bash
cd whisper-service-v2
npm install
```

2. Start Redis locally or use an external Redis URL:

```bash
export REDIS_URL=redis://127.0.0.1:6379
```

3. Run the API service:

```bash
npm start
```

4. Run the worker in another terminal:

```bash
npm run worker
```

## API

### Health

```http
GET /health
```

### Transcribe base64 audio

```http
POST /v1/transcribe-base64
Content-Type: application/json
```

Body:

```json
{
  "file_data": "<base64>",
  "mime_type": "audio/ogg",
  "target_language": "eng_Latn"
}
```

Response:

```json
{
  "text": "...",
  "language": "rus",
  "translated": "...",
  "target_language": "eng_Latn",
  "cache_hit": false
}
```

## Caching

The service caches audio by SHA256 of the first 8KB.
Cache key format: `whisper-v2:cache:<hash>`
TTL default: `3600` seconds.

## Environment variables

- `PORT` — HTTP port (default `8000`)
- `REDIS_URL` — Redis connection string
- `CACHE_TTL` — cache TTL seconds (default `3600`)
- `NUM_THREADS` — ASR thread count (default `4`)
- `PUNCT_THREADS` — only used if you keep the optional zh/en CT-Transformer model (default `2`)
- `TRANSLATE_SERVICE_URL` — translation backend URL
- `MODELS_DIR` — path to local models (default `/models`)
- `WORKER_CONCURRENCY` — worker concurrency

## Kubernetes

The `whisper-service-v2` deployment uses a PVC-backed model cache and a one-time downloader job.
The downloader script is run on the server and saves models into the persistent volume at `/models`.
On a redeploy, the existing model files are reused and are not downloaded again unless they are missing.

See `kubernetes/base/whisper-service-v2.yaml` for deployment manifests.

## Server-side model downloader

A reusable downloader script is available at `scripts/download-models.sh`.
It is intended to run on the server, not on the local laptop, and will skip files that already exist.

To run it manually on the cluster host or in a helper pod:

```bash
cd whisper-service-v2
chmod +x scripts/download-models.sh
MODELS_DIR=/models ./scripts/download-models.sh
```

If you are using Kubernetes, the built-in job in `k8s/whisper-service-v2.yaml` already performs the same download flow.

