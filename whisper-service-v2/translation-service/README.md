# Translation Service

This service provides offline NLLB-200 inference for text translation.
It is intended to be used by `whisper-service-v2` when `target_language` is passed.

## Build

This service expects the NLLB-200 model files to be available locally in `MODEL_PATH`.

```bash
cd whisper-service-v2/translation-service
docker build -t your-registry/translation-service:latest .
```

## Run

```bash
docker run --rm -p 8001:8001 \
  -e MODEL_PATH=/hf-cache/facebook/nllb-200-distilled-600M \
  -v /path/to/local/nllb-model:/hf-cache/facebook/nllb-200-distilled-600M \
  your-registry/translation-service:latest
```

## API

- `GET /health`
- `GET /v1/languages`
- `POST /v1/translate`

Example body:

```json
{
  "text": "Привет",
  "source_lang": "rus_Cyrl",
  "target_lang": "eng_Latn"
}
```
