import 'dotenv/config';

// WhatsApp Baileys doesn't need API_ID/API_HASH like Telegram
export const API_ID = 0; // Placeholder for compatibility
export const API_HASH = ''; // Placeholder for compatibility

export const SECRET = (process.env.MANAGER_SECRET || 'changeme').trim();
export const PORT = parseInt(process.env.PORT || '3000', 10);
export const TARGET_USER_ID = process.env.TARGET_USER_ID || '';
export const WORKER_URL = process.env.WORKER_URL || '';
export const DEVICE_MODEL = process.env.DEVICE_MODEL || 'Voicemsg-net WhatsApp (Baileys)';
export const APP_VERSION = process.env.APP_VERSION || '1.0.0';
export const SYSTEM_VERSION = process.env.SYSTEM_VERSION || 'Linux';
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/voicemsg';

// Initialize Redis if needed (for manager mode)
export const redis = null; // Will be initialized in manager if needed