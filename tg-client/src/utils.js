import * as tdl from 'tdl';
import { getTdjson } from 'prebuilt-tdlib';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { TG_API_ID, TG_API_HASH } from './config.js';

// Prioritize custom-compiled TDLib path if provided and exists (e.g. for custom Debian build)
const customPath = process.env.TDLIB_PATH;
const tdjsonPath = (customPath && fs.existsSync(customPath)) ? customPath : getTdjson();
tdl.configure({ tdjson: tdjsonPath });

export function createClient(userId, options = {}) {
    const dbDir = path.join('/app/tdlib-data', String(userId));
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    console.log(`[tg-client-utils] Creating TDLib client for user "${userId}"`);
    console.log(`[tg-client-utils] Configured databaseDirectory: ${dbDir}`);

    const client = tdl.createClient({
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
            use_file_database: false,
            use_secret_chats: true,
            device_model: "voicemsg-net client-server",
            system_language_code: "en",
            system_version: "Linux",
            application_version: "1.0.0",
            enable_storage_optimizer: true
        },
        ...options
    });
    return client;
}

export function unpackSession(userId, base64) {
    if (!base64 || base64.length < 100) return null;
    const dbDir = path.join('/app/tdlib-data', String(userId));
    try {
        if (fs.existsSync(dbDir)) fs.rmSync(dbDir, { recursive: true, force: true });
        fs.mkdirSync(dbDir, { recursive: true });
        const zip = new AdmZip(Buffer.from(base64, 'base64'));
        const entries = zip.getEntries();
        console.log(`[utils] Unpacking session for ${userId}: ${entries.length} files found in ZIP`);
        zip.extractAllTo(dbDir, true);
        console.log(`[utils] Successfully unpacked session for ${userId} to ${dbDir}`);
        return dbDir;
    } catch (e) {
        console.error(`[utils] Failed to unpack session for ${userId}:`, e.message);
        return null;
    }
}
