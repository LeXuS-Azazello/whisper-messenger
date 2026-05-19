import fs from 'fs';
import path from 'path';
import { Env } from '../../src/types';

// Shared directory for media files that need to be accessed by whisper-service
const SHARED_DIR = '/shared/whatsapp-files';

export function ensureSharedDir() {
    if (!fs.existsSync(SHARED_DIR)) {
        fs.mkdirSync(SHARED_DIR, { recursive: true });
    }
}

export function getSharedPath(fileId, mimeType = 'audio/ogg') {
    ensureSharedDir();
    const ext = mimeType === 'video/mp4' ? '.mp4' : '.ogg';
    return path.join(SHARED_DIR, `${fileId}${ext}`);
}

export function saveSession(userId, sessionData) {
    // In whatsapp-web.js with RemoteAuth, session handling is done automatically
    // This is just a placeholder for compatibility with manager interface
    return true;
}

export function loadSession(userId) {
    // Session loading is handled by RemoteAuth in whatsapp-web.js
    // This is just a placeholder for compatibility with manager interface
    return null;
}

export function deleteSession(userId) {
    // Session deletion is handled by RemoteAuth in whatsapp-web.js
    // This is just a placeholder for compatibility with manager interface
    return true;
}