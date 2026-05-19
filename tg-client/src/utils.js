import * as tdl from 'tdl';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { TG_API_ID, TG_API_HASH } from './config.js';

const require = createRequire(import.meta.url);

const customPath = process.env.TDLIB_PATH;
let tdjsonPath;
if (customPath && fs.existsSync(customPath)) {
    tdjsonPath = customPath;
} else {
    try {
        const { getTdjson } = require('prebuilt-tdlib');
        tdjsonPath = getTdjson();
    } catch (e) {
        throw new Error(`[tg-client-utils] TDLib binary not found! Please set TDLIB_PATH or install prebuilt-tdlib.`);
    }
}
tdl.configure({ tdjson: tdjsonPath });

export function createClient(userId, options = {}) {
    const dbDir = path.join('/app/tdlib-data', String(userId));
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    return tdl.createClient({
        apiId: Number(TG_API_ID),
        apiHash: TG_API_HASH,
        databaseDirectory: dbDir,
        filesDirectory: path.join(dbDir, 'files'),
        skipOldUpdates: true,
        tdlibParameters: {
            database_directory: dbDir,
            files_directory: path.join(dbDir, 'files'),
            use_message_database: false,
            use_chat_info_database: false,
            use_file_database: true,
            use_secret_chats: true,
            device_model: "voicemsg-net client-server",
            system_language_code: "en",
            system_version: "Linux",
            application_version: "1.0.0",
            enable_storage_optimizer: true
        },
        ...options
    });
}

export function unpackSession(userId, base64) {
    if (!base64 || base64.length < 100) return null;
    const dbDir = path.join('/app/tdlib-data', String(userId));
    try {
        if (fs.existsSync(dbDir)) fs.rmSync(dbDir, { recursive: true, force: true });
        fs.mkdirSync(dbDir, { recursive: true });
        const zip = new AdmZip(Buffer.from(base64, 'base64'));
        zip.extractAllTo(dbDir, true);
        return dbDir;
    } catch (e) {
        console.error(`[utils] Failed to unpack session for ${userId}:`, e.message);
        return null;
    }
}
