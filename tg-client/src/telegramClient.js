import TdClient from './tdweb/index.js';
import { TARGET_USER_ID, TG_API_ID, TG_API_HASH } from './config.js';

let client = null;

/**
 * tg-client debug mode:
 * - Listens to all updates via onUpdate
 * - Prints EVERY update to console
 * - Prints all errors to console
 * - Does NOT save anything, does NOT reply, does NOT transcribe
 */
function logUpdate(update) {
    console.log('[tg-client] UPDATE:', JSON.stringify(update, null, 2));
}

function logError(err, context = '') {
    console.error(`[tg-client] ERROR${context ? ' ' + context : ''}:`, err?.stack || err?.message || err);
}

export async function startTelegramClient() {
    if (client) {
        try { await client.close(); } catch (_) {}
    }

    client = new TdClient({
        onUpdate: (update) => {
            logUpdate(update);
        },
        instanceName: `user_${TARGET_USER_ID}`,
        jsLogVerbosityLevel: 'info',
        logVerbosityLevel: 1,
        useDatabase: true
    });

    client.onError = (err) => logError(err, 'TDLib');

    try {
        await client.send({
            '@type': 'setTdlibParameters',
            database_directory: `/tmp/tdlib/user_${TARGET_USER_ID}`,
            files_directory: `/tmp/tdlib/user_${TARGET_USER_ID}/files`,
            use_file_database: true,
            use_chat_info_database: true,
            use_message_database: true,
            use_secret_chats: false,
            api_id: Number(TG_API_ID),
            api_hash: TG_API_HASH,
            system_language_code: 'en',
            device_model: 'Voicemsg tg-client',
            application_version: '1.0',
            enable_storage_optimizer: true
        });

        console.log(`[tg-client] Started for user ${TARGET_USER_ID} (console-only debug mode)`);
    } catch (e) {
        logError(e, 'setTdlibParameters');
    }
}

export function stopTelegramClient() {
    if (client) {
        client.close().catch(() => {});
        client = null;
    }
}
