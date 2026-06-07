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
    const dbDir = path.join('/temporaly-media-msg', String(userId));
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
    const dbDir = path.join('/temporaly-media-msg', String(userId));
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


// Telegram language_code → NLLB code for translation
export function telegramLangToNLLB(code) {
    if (!code) return 'eng_Latn';

    const normalized = code.toLowerCase();

    const map = {
        // Major
        'ru': 'rus_Cyrl',
        'ua': 'ukr_Cyrl',
        'en': 'eng_Latn',
        'de': 'deu_Latn',
        'fr': 'fra_Latn',
        'es': 'spa_Latn',
        'it': 'ita_Latn',
        'pt': 'por_Latn',
        'nl': 'nld_Latn',
        'pl': 'pol_Latn',
        'tr': 'tur_Latn',

        // Asian
        'th': 'tha_Thai',           // Thai
        'vi': 'vie_Latn',           // Vietnamese
        'id': 'ind_Latn',           // Indonesian
        'ms': 'msa_Latn',           // Malay
        'ja': 'jpn_Jpan',           // Japanese
        'ko': 'kor_Hang',           // Korean

        // Chinese
        'zh': 'zho_Hans',           // Chinese Simplified (default)
        'zh-hans': 'zho_Hans',
        'zh-cn': 'zho_Hans',
        'zh-hant': 'zho_Hant',      // Traditional
        'zh-tw': 'zho_Hant',
        'zh-hk': 'zho_Hant',

        // South Asian
        'hi': 'hin_Deva',           // Hindi
        'bn': 'ben_Beng',           // Bengali
        'ta': 'tam_Taml',           // Tamil
        'te': 'tel_Telu',           // Telugu
        'mr': 'mar_Deva',           // Marathi
        'gu': 'guj_Gujr',           // Gujarati
        'pa': 'pan_Guru',           // Punjabi

        // Southeast Asian
        'km': 'khm_Khmr',           // Khmer (Cambodian)
        'lo': 'lao_Laoo',           // Lao
        'my': 'mya_Mymr',           // Burmese
        'fil': 'tgl_Latn',          // Filipino/Tagalog
        'tl': 'tgl_Latn',

        // Middle East
        'ar': 'arb_Arab',           // Arabic
        'fa': 'pes_Arab',           // Persian (Farsi)
        'ur': 'urd_Arab',           // Urdu

        // Other useful
        'uk': 'ukr_Cyrl',
        'he': 'heb_Hebr',
        'el': 'ell_Grek',
        'cs': 'ces_Latn',
        'hu': 'hun_Latn',
        'sv': 'swe_Latn',
        'da': 'dan_Latn',
        'fi': 'fin_Latn',
        'no': 'nob_Latn',
    };

    return map[normalized] || 'eng_Latn'; // fallback to English
}

// Nice labels with flags (supports short codes + NLLB codes like eng_Latn, rus_Cyrl)
export function getLangLabel(code) {
    if (!code) return '🌐 auto';

    const normalized = code.toLowerCase().split('_')[0];

    const map = {
        // English
        en: "🇺🇸",
        eng: "🇺🇸",

        // Russian
        ru: "🇷🇺",
        rus: "🇷🇺",

        // Ukrainian
        uk: "🇺🇦",
        ukr: "🇺🇦",

        // Hebrew
        he: "🇮🇱",
        heb: "🇮🇱",

        // German
        de: "🇩🇪",
        deu: "🇩🇪",
        ger: "🇩🇪",

        // French
        fr: "🇫🇷",
        fra: "🇫🇷",
        fre: "🇫🇷",

        // Spanish
        es: "🇪🇸",
        spa: "🇪🇸",

        // Thai
        th: "🇹🇭",
        tha: "🇹🇭",

        // Chinese
        zh: "🇨🇳",
        zho: "🇨🇳",
        chi: "🇨🇳",

        // Japanese
        ja: "🇯🇵",
        jpn: "🇯🇵",

        // Korean
        ko: "🇰🇷",
        kor: "🇰🇷",

        // Arabic
        ar: "🇸🇦",
        ara: "🇸🇦",

        // Vietnamese
        vi: "🇻🇳",
        vie: "🇻🇳",

        // Indonesian
        id: "🇮🇩",
        ind: "🇮🇩",

        // Turkish
        tr: "🇹🇷",
        tur: "🇹🇷",

        // Portuguese
        pt: "🇵🇹",
        por: "🇵🇹",

        // Italian
        it: "🇮🇹",
        ita: "🇮🇹",

        // Polish
        pl: "🇵🇱",
        pol: "🇵🇱",

        // Dutch
        nl: "🇳🇱",
        nld: "🇳🇱",
        dut: "🇳🇱",

        // Hindi
        hi: "🇮🇳",
        hin: "🇮🇳",

        // Auto / unknown
        auto: "🌐",
    };

    return map[normalized] || `🌐`;
}

export function logError(err, context = '') {
    console.error(`[tg-client] ERROR${context ? ' ' + context : ''}:`, err?.stack || err?.message || err);
}
