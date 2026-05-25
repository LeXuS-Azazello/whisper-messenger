# SAMESAME

`SAMESAME` — отдельный премиум-сервис для голосового клонирования ответа в голос отправителя.

## Что делает

1. Получает аудио отправителя как `base64`.
2. Извлекает голосовой профиль из примера.
3. Синтезирует текст ответа в его голосе.
4. Возвращает `audio/wav` или `audio/ogg`.

## 📢 Recent Changes (May 2026)
- Switched to **FunAudioLLM/CosyVoice2‑0.5B** (CPU‑optimized) instead of XTTS.
- Added Docker base image `python:3.10‑slim` and removed Miniconda.
- Models download via dedicated Job; PVC size increased to 6 GiB.
- `samesame` now reports **Model ready** on startup.

Особенности текущей реализации:
1. **CPU Оптимизация**: Работает на процессорах без GPU. Для ускорения инференса используется принудительное выделение потоков (`OMP_NUM_THREADS="4"` и `torch.set_num_threads(4)`).
2. Модели скачиваются **только** через dedicated Kubernetes Job (`samesame-downloader-job.yaml`) в PVC. Никогда не на локальной машине. Маркер-файлы предотвращают повторные скачивания при последующих деплоях.

## API

### Health

```http
GET /health
```

### Clone voice

```http
POST /v1/clone
Authorization: Bearer <SAMESAME_SECRET>
Content-Type: application/json
```

Body:

```json
{
  "source_audio_base64": "...",
  "source_mime_type": "audio/ogg",
  "text": "да чувак, спасибо что шлёшь мне голосовые!",
  "language": "ru",
  "output_format": "ogg"
}
```

Ответ: raw аудио в формате `wav` или `ogg`.

## Развертывание

1. Убедитесь, что в `.env` задан `HUGGINGFACE_API_KEY`.
2. Добавьте `SAMESAME_SECRET` в корень `.env` (он будет лежать в секрете `samesame-secret`).
3. Просто запусти основной деплой — всё соберётся и задеплоится автоматически:

```bash
./scripts/deploy.sh
```

Скрипт:
- Соберёт и запушит образ `samesame`
- Применит все манифесты (включая `samesame.yaml`)
- Дождётся готовности пода
- Автоматически запустит `samesame-downloader-job.yaml` (модели скачаются один раз в PVC)

4. После деплоя сервис доступен внутри кластера по адресу:

```
http://samesame:8002
```

(Полный DNS: `http://samesame.debugging-testcrash-pub.svc.cluster.local:8002`)

## Секреты

- `HUGGINGFACE_API_KEY` — из `.env` (попадает в секрет `huggingface-token`). Обязателен для скачивания моделей с HF.
- `SAMESAME_SECRET` — хранится в `kubernetes/base/samesame-secret.yaml` (генерится при деплое из `.env`).

## Особенности

- Модели скачиваются **только** через отдельный Job (`samesame-downloader-job.yaml`).
- Основной сервис всегда стартует с `SAMESAME_LOCAL_ONLY=true` → `HF_LOCAL_FILES_ONLY=true` (никаких скачиваний во время работы).
- Это **отдельный премиум-сервис**. Пока что он не подключён ни к одному мессенджеру (см. ниже).

## Статус интеграции и логика работы (важно!)

- **Telegram (tg-client)**: поддерживается команда `!SAMESAME! [язык] текст` в ответе на голосовое/кружок.
  - Пример: `!SAMESAME! Привет, как дела?` (язык по умолчанию `ru`)
  - Явный язык: `!SAMESAME! en Hello world`

> **Внимание:** Функционал «автоматического эха» (когда бот сам генерировал голос в ответ на любое входящее аудио) был **УДАЛЕН**. Это сделано для того, чтобы не забивать сервер многоминутными вычислениями на CPU. Клонирование голоса происходит **ИСКЛЮЧИТЕЛЬНО** по явному реплаю командой `!SAMESAME!`. Таймаут ожидания ответа на клиенте увеличен до 15 минут, чтобы гарантированно дождаться синтеза (занимает ~2-5 мин в зависимости от текста).

Другие клиенты (WhatsApp, FB, IG) — в процессе подключения (используют общую логику из `shared/samesame.js`).
