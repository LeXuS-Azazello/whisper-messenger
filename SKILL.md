Стек: sherpa-onnx SenseVoice INT8 + Silero VAD + CT-Transformer Punctuation + BullMQ + Redis SHA256 Cache + NLLB-200 Translation

Instant response

BullMQ Queue
Redis backend

Worker 1
concurrency=2

Worker 2

ffmpeg → PCM 16kHz

Silero VAD
Remove silence/noise

SenseVoice INT8
Auto-detect language

CT-Transformer
Offline Punctuation

target_language?

NLLB-200
Translation Service

Save to Redis Cache

Return result
