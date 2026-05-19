import * as tdl from 'tdl';
import { getTdjson } from 'prebuilt-tdlib';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';

export const authSessions = new Map<string, any>();

// Configure tdl to use the native binary
tdl.configure({ tdjson: getTdjson() });

export function createTdClient(userId: string, options: any = {}) {
    const dbDir = path.join('/tmp/tdlib', String(userId || 'manager'));
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const client = tdl.createClient({
        apiId: Number(process.env.TELEGRAM_APP_ID || 2222),
        apiHash: process.env.TELEGRAM_APP_HASH || 'changeme',
        databaseDirectory: dbDir,
        filesDirectory: path.join(dbDir, 'files'),
        skipOldUpdates: true,
        ...options
    });

    return client;
}

export function packSession(userId: string) {
    const dbDir = path.join('/tmp/tdlib', String(userId));
    if (!fs.existsSync(dbDir)) {
        console.warn(`[tdlibManager] Cannot pack session for ${userId}: directory not found at ${dbDir}`);
        return null;
    }
    try {
        const zip = new AdmZip();
        zip.addLocalFolder(dbDir);
        return zip.toBuffer().toString('base64');
    } catch (e: any) {
        console.error(`[tdlibManager] Failed to pack session for ${userId}:`, e.message);
        return null;
    }
}

export function unpackSession(userId: string, base64: string) {
    if (!base64 || base64.length < 100) return null;
    const dbDir = path.join('/tmp/tdlib', String(userId));
    try {
        if (fs.existsSync(dbDir)) fs.rmSync(dbDir, { recursive: true, force: true });
        fs.mkdirSync(dbDir, { recursive: true });
        const zip = new AdmZip(Buffer.from(base64, 'base64'));
        zip.extractAllTo(dbDir, true);
        console.log(`[tdlibManager] Successfully unpacked session for ${userId} to ${dbDir}`);
        return dbDir;
    } catch (e: any) {
        console.error(`[tdlibManager] Failed to unpack session for ${userId}:`, e.message);
        return null;
    }
}
