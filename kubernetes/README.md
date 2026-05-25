# Kubernetes Deployment Structure

В этой директории находятся Kustomize-манифесты для развертывания всего проекта `Voice Messenger` в Kubernetes. Проект использует единый подход на основе `kustomization.yaml` для управления ресурсами.

## 📂 Структура файлов (`kubernetes/base/`)

Ниже приведено описание основных YAML-файлов, разбитых по логическим группам.

### 🧠 Core Services (AI и Обработка)
| Файл | Описание |
|------|----------|
| `whisper-service-v2.yaml` | Главный микросервис транскрибации (FastAPI + BullMQ Worker + Whisper ONNX). Обрабатывает тяжелые задачи по переводу аудио в текст. Содержит Deployment для API и отдельный Deployment для Worker. |
| `samesame.yaml` | Премиум-сервис для клонирования голоса (XTTS v2). Обрабатывает запросы от клиентов, работает исключительно на CPU с многопоточной оптимизацией. |
| `voicemsg-tester.yaml` | Интеграционный тестер для проверки всей цепочки (проверка Redis, Mongo, Whisper ASR и SAMESAME). |

### 🤖 Managers (Управление клиентскими подами)
Архитектура подразумевает динамическое создание подов для каждого пользователя (per-user pod). За это отвечают менеджеры:
| Файл | Описание |
|------|----------|
| `tg-client-manager.yaml` | Оркестратор для создания `tg-client` (Telegram tdlib) подов. |
| `whatsapp-baileys-manager.yaml` | Оркестратор для WhatsApp (Baileys) подов. Поддерживает QR, Phone Pairing. |
| `facebook-fca-manager.yaml` | Оркестратор для Facebook Messenger (FCA) подов. |
| `instagram-fca-manager.yaml` | Оркестратор для Instagram Direct (FCA) подов. |
| `tg-client.yaml` | *Шаблон/базовый конфиг* (если используется для самостоятельного деплоя), обычно менеджер сам создает поды. |

### 🗄️ Базы данных и Инфраструктура
| Файл | Описание |
|------|----------|
| `redis.yaml` | СУБД Redis. Используется для очередей (BullMQ), сессий пользователей (whatsapp_session, tg_session) и статистики. |
| `mongodb.yaml` | База данных MongoDB (хранит общие настройки, юзеров, статистику). |
| `mongo-express.yaml` | Web-интерфейс для управления MongoDB. Доступен по внутреннему роуту/порт-форварду. |
| `frontend.yaml` | Web-дашборд приложения (UI для управления мессенджерами) и Hono Backend-прослойка. |

### 🛠️ Jobs (Автоматические задачи)
Задачи (Jobs), которые запускаются одноразово при деплое или по крону:
| Файл | Описание |
|------|----------|
| `whisper-service-v2-downloader-job.yaml` | Скачивает модели Whisper (large-v3-turbo-int8) из Hugging Face в общий PVC перед стартом воркеров. |
| `samesame-downloader-job.yaml` | Скачивает XTTS v2 модель для `samesame`. |
| `whisper-models-cleanup-job.yaml` | Крон-джоба/скрипт для очистки неиспользуемых моделей в PVC для экономии диска. |

### 🔐 Секреты и RBAC
Поскольку менеджеры динамически управляют подами, им нужны права Kubernetes API:
| Файл | Описание |
|------|----------|
| `rbac.yaml` | ServiceAccount, Role и RoleBinding, дающие менеджерам право делать `kubectl create pod` / `deployment` в неймспейсе. |
| `rbac-whisper-exec.yaml` | Дополнительные права для тестера или специфичных скриптов на выполнение `exec` внутри подов. |
| `huggingface-secret.yaml` | Секрет с `HUGGINGFACE_API_KEY` для докачки моделей. |
| `samesame-secret.yaml` | Секрет с `SAMESAME_SECRET` для авторизации API SAMESAME. |

### 🌐 Сеть и Сертификаты
| Файл | Описание |
|------|----------|
| `voicemsg-cf.yaml` | Конфигурация Cloudflare Tunnel для экспозиции сервисов наружу без открытых портов. |
| `cert-manager.yaml` | Конфигурация TLS-сертификатов. |
| `*-network-policy.yaml` | NetworkPolicies для изоляции подов между собой (безопасность). |

## 🚀 Развертывание
Все YAML-файлы собираются в один пайплайн через `kustomization.yaml`. 
Запуск полного цикла деплоя осуществляется скриптом из корня проекта:
```bash
# Собирает образы, пушит в registry и применяет kustomization
./scripts/deploy.sh
```
Или локально:
```bash
kubectl apply -k kubernetes/base -n debugging-testcrash-pub
```
