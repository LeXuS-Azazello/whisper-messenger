Telegram Voice Transcription Platform Refactor
Goal

Perform a major architecture refactor of the Kubernetes-based Telegram voice transcription platform.

Analyze all *.yaml Kubernetes manifests and refactor the infrastructure and services according to the requirements below.

UserStats must be in tg-client-{telegram_user_id}. and saving to MongoDB User document.

Main Refactor Tasks
1. Remove all bridge services

Completely remove and deprecate the following services:

whisper-bridge-manager
mtproto-bridge-manager
mtproto-bridge

All Telegram-related logic must be migrated into:

tg-client
tg-client-manager

No bridge architecture should remain.

2. Introduce tg-client-manager as the main orchestration service

tg-client-manager becomes the central Telegram client orchestrator.

Responsibilities:

dynamically create Telegram client PODs
destroy PODs
reconnect clients
monitor statuses
register authorized sessions
manage lifecycle of all Telegram clients

Each authorized Telegram account must run in its own isolated POD:

tg-client-{telegram_user_id}

Example:

tg-client-123456789
tg-client-987654321
3. Dynamic Telegram authorization system

tg-client-manager must support ALL available Telegram authentication methods supported by TDLib / Telegram API.

Required auth methods:

QR Code login
phone number login
user_id authorization
email + login + password
getPassportAuthorizationForm
getLoginUrl
2FA password
session restore
bot login (optional if architecture allows)

The manager must expose a unified internal API for authorization workflows.

4. Client lifecycle management API

tg-client-manager must implement centralized control APIs.

Required operations:

spawn client POD
delete client POD
restart POD
disconnect session
reconnect session
get client status
list active clients
register session
restore session
health monitoring
heartbeat monitoring
crash recovery
5. Persistent session storage

After successful Telegram authorization:

Store authorization/session data in:

Redis (primary fast access)
MongoDB (persistent backup)

Purpose:

automatic recovery after restart
POD recreation
failover recovery
horizontal scaling
reconnect without re-authentication
6. Voice message transcription pipeline

Each:

tg-client-{telegram_user_id}

must listen for Telegram updates/events.

DO NOT save any files on this worker/pod (except temp files for ffmpeg).

Required behavior:

Detect:
voice messages
video notes ("circles")
Processing pipeline:
Download media
Extract audio using ffmpeg
Transcribe audio to text
Reply directly to the original Telegram message with transcription text
7. Whisper model configuration

Transcription model must be dynamically configurable.

Configuration source:

Redis -> config_whisper_model

The selected model must be passed into tg-client through:

Environment Variables

The model is configured from the admin panel.

Technical Requirements
Kubernetes

Refactor all Kubernetes YAML manifests accordingly.

Expected changes:

deployments
services
configmaps
secrets
ingress
autoscaling
RBAC
namespaces
redis connectivity
mongodb connectivity
pod templates
dynamic pod creation permissions
Required Technologies / Skills
TDLib / TDWeb

Must understand and use:

TDLib
TDWeb
Telegram authorization flows
Telegram updates/events
Telegram media handling

Resources:

TDWeb Example
TDWeb index.js
TDWeb worker.js
TDWeb wasm-utils.js
Expected Output

The agent must:

Analyze the existing architecture
Analyze all Kubernetes YAML manifests
Produce a migration/refactor plan
Refactor architecture to remove bridge services
Implement centralized tg-client-manager
Implement dynamic POD orchestration
Implement Telegram auth flows
Implement voice transcription pipeline
Ensure persistent session recovery
Update all manifests and dependencies
Important Constraints
Keep architecture horizontally scalable
Avoid shared mutable session state
One Telegram account = one isolated POD
Redis is the primary runtime state store
MongoDB is the persistent backup store
Use environment variables for runtime configuration
System must survive POD restarts without losing Telegram authorization
Architecture must support thousands of concurrent Telegram clients
Additional Notes

Use clean modular architecture.

Prefer:

event-driven design
stateless manager services
isolated workers
fault tolerance
reconnect resilience
async processing
streaming transcription pipeline