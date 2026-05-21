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
2. Добавьте `SAMESAME_SECRET` в корень `.env`.
3. Соберите образ:

```bash
cd samesame
docker build -t your-registry/samesame:latest .
```

4. На Kubernetes запустите модель-загрузчик и сервис:

```bash
kubectl apply -f kubernetes/base/samesame.yaml -n debugging-testcrash-pub
```

5. Дождитесь завершения Job `samesame-model-downloader`.
6. Подключите клиентов к `http://samesame.debugging-testcrash-pub.svc.cluster.local:8002`.

## Секреты

- `HUGGINGFACE_API_KEY` берется из `.env` на сборке / из секрета `huggingface-token` в кластере.
- `SAMESAME_SECRET` должен храниться в `kubernetes/base/samesame-secret.yaml` и не попадать в логи.

## Особенности

- Модель скачивается один раз в PVC `/models`.
- Сервис работает с `SAMESAME_LOCAL_ONLY=true`, чтобы не перекачивать модель на каждый рестарт.
- Это отдельный сервис, не смешиваем с `whisper-service-v2`.
