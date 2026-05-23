# Whisper Service v2 — TODO

## Цель
Подготовить `whisper-service-v2` как быстрый CPU-only ASR/translation pipeline на базе:
- `sherpa-onnx` SenseVoice INT8
- `Silero VAD`
- Simple offline punctuation for 100+ languages (CT-Transformer optional bonus for zh/en)
- `BullMQ` + Redis очередь
- Redis SHA256 cache
- `NLLB-200` перевод

## Основные задачи

### 1. Реализовать сервис `whisper-service-v2`
- [ ] добавить `src/app.js` с Express API
- [ ] добавить эндпоинты:
  - `GET /health`
  - `POST /v1/transcribe-base64`
- [ ] принимать `file_data`, `mime_type`, `language`, `target_language`
- [ ] сохранять данные запроса в очередь BullMQ для фоновой обработки
- [ ] возвращать `jobId` / прогресс / результат

### 2. Реализовать worker для обработки задач
- [ ] создать `src/worker.js`
- [ ] использовать `queue.js` и `BullMQ`
- [ ] для каждого задания:
  - загрузка аудио из base64
  - декодирование через `ffmpeg` → PCM 16 kHz mono
  - вычисление SHA256 первых 8KB
  - проверка Redis кэша
  - применение Silero VAD
  - ASR через sherpa-onnx SenseVoice
  - offline punctuation для большинства языков (простая + опциональный CT-Transformer)
  - запись результата в Redis TTL 1h
- [ ] поддержка повторных попыток и отказоустойчивости

### 3. Добавить Redis SHA256 кэш
- [ ] хэшировать первые 8KB аудио как `sha256(file.slice(0, 8192))`
- [ ] ключ: `whisper-v2:cache:<hash>`
- [ ] TTL: `3600` секунд
- [ ] возвращать сохранённый результат, если доступен
- [ ] кэшировать `text`, `language`, `translated`, `target_language`, `model`

### 4. Конфигурация и переменные окружения
- [ ] `REDIS_URL`
- [ ] `ASR_QUEUE` (по умолчанию `asr-v2`)
- [ ] `CACHE_TTL` (по умолчанию `3600`)
- [ ] `NUM_THREADS`, `NUM_INTER_THREADS`
- [ ] `MODELS_DIR` (по умолчанию `/models`)
- [ ] `TARGET_LANGUAGE` / `AUTO_TRANSLATE`

### 5. Интеграция с переводом
- [ ] использовать `language` из ASR/Language ID
- [ ] возвращать структуру ответа:
  - `text`
  - `language`
  - `translated`
  - `target_language`
  - `cache_hit`
  - `elapsed_ms`

### 6. Тестирование и локальная проверка
- [ ] протестировать локально через `curl`
- [ ] проверить поведение кэша на одинаковых аудио
- [ ] проверить параллельную обработку нескольких заданий
- [ ] проверить восстановление при падении worker

## Дополнительные улучшения
- [ ] добавить предиктивное определение языка Sherpa Language ID
- [ ] адаптивный выбор модели для коротких/длинных голосовых сообщений
- [ ] webhook/зарядка мониторинга для очереди и Redis
- [ ] добавить `service account` и `securityContext` в K8s
- [ ] создать `Dockerfile` для `whisper-service-v2`

## Примечание
В текущем репозитории уже есть `whisper-service-v2/src/queue.js`. Следующий шаг — дополнить проект реальным `src/app.js` и `src/worker.js`, а затем задеплоить по манифестам ниже.
