# SAMESAME

`SAMESAME` — отдельный премиум-сервис для голосового клонирования ответа в голос отправителя.

## Что делает

1. Получает аудио отправителя как `base64`.
2. Извлекает голосовой профиль из примера.
3. Синтезирует текст ответа в его голосе.
4. Возвращает `audio/wav` или `audio/ogg`.

## Стек моделей

Для максимального качества мы используем:

- `tts_models/multilingual/multi-dataset/your_tts` — основной TTS-клонер голоса
- `vocoder_models/universal/libritts/fullband-melgan` — высококачественный вокодер

Это лучший доступный публичный стек для редкого премиального режима: отличное звучание, голосовой тембр и клонирование по референсу.

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

- `HUGGINGFACE_API_KEY` — из `.env` (попадает в секрет `huggingface-token`).
- `SAMESAME_SECRET` — хранится в `kubernetes/base/samesame-secret.yaml` (генерится при деплое из `.env`).

## Особенности

- Модели скачиваются **только** через отдельный Job (`samesame-downloader-job.yaml`).
- Основной сервис всегда стартует с `SAMESAME_LOCAL_ONLY=true` → `HF_LOCAL_FILES_ONLY=true` (никаких скачиваний во время работы).
- Это **отдельный премиум-сервис**. Пока что он не подключён ни к одному мессенджеру (см. ниже).

## Статус интеграции (важно!)

На момент 2026-05-23 голосовое клонирование через `!SAMESAME!` **ещё не реализовано** ни в одном клиенте (tg-client, whatsapp-baileys-client, facebook-fca-client, instagram-fca-client).

Сервис готов, но логика «если в ответе на голосовое есть `!SAMESAME! текст` — вызвать `/v1/clone` и отправить результат» — **пока отсутствует**.
