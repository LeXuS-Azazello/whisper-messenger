# WhatsApp Baileys Infrastructure Resume

## Architecture Overview
The WhatsApp integration follows a **Pod-per-User** architecture to ensure isolation, stability, and scalability. It consists of two primary components: the **Manager** (Control Plane) and the **Client** (Data Plane).

### 1. WhatsApp Baileys Manager (Control Plane)
The Manager acts as the orchestrator for the individual WhatsApp client pods.
- **Pod Lifecycle Management**: Uses the Kubernetes API to spawn, list, and delete user-specific client pods.
- **Authentication Bridge**: Orchestrates the flow of QR codes and Pairing Codes between the Baileys WebSocket and the end-user UI via Redis.
- **State Coordination**: Manages session restoration by retrieving session data from Redis/MongoDB and passing it to the corresponding client pod during initialization.
- **Health Monitoring**: Provides a centralized interface to check the connectivity status of all active WhatsApp launchees.

### 2. WhatsApp Baileys Client (Data Plane)
Each user is assigned a dedicated lightweight pod running the `@whiskeysockets/baileys` library.
- **WebSocket Connection**: Maintains a persistent connection to WhatsApp Web using a headless WebSocket implementation (no browser required).
- **Session Persistence**: Utilizes a shared PVC (`/app/sessions`) to store authentication credentials, ensuring sessions survive pod restarts.
- **Auth Lifecycle**:
    - **QR Flow**: Generates QR codes and reports them to Redis for UI display.
    - **Pairing Flow**: Requests pairing codes via the Manager, allowing phone-number-based linking.
- **Media Processing**: Listens for incoming audio/video messages, downloads them to a shared temporary storage volume, and triggers the ASR (Automatic Speech Recognition) pipeline.
- **Interactive Commands**: Implements internal bot commands (e.g., `/lang`) to allow users to manage translation settings directly within WhatsApp.
- **SAMESAME Integration**: Handles voice cloning requests via the `!SAMESAME!` command, integrating with the voice cloning backend.

## Key Technical Fixes
- **Auth Stability**: Eliminated the "self-destruct" logic that crashed pods during QR generation, allowing for seamless new-user onboarding.
- **UI Synchronization**: Implemented conditional rendering of connection controls, ensuring "Disconnect" options only appear upon successful authentication.
- **Redis Signaling**: Introduced a request-response pattern via Redis to enable asynchronous pairing code generation.
