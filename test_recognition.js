
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // Assuming it's available or we can use dynamic import

const AUDIO_FILE = 'audio_test.ogg';
const LOCAL_URL = 'https://whisper-onnx.debug.org.ua/transcribe';
const LOCAL_SECRET = 'whisper-sh-secret-2026';

const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4/accounts/a21fdd02-2e16-4eee-a0cf-3fe5fa835bb8/ai/run/@cf/openai/whisper-tiny-en';
const CLOUDFLARE_TOKEN = process.env.WHISPER_CLOUDFLARE_TOKEN; // Need to get this

async function testLocal() {
    console.log('--- Testing Local Sherpa ---');
    const buffer = fs.readFileSync(AUDIO_FILE);
    const { FormData, Blob } = await import('node-fetch'); // node-fetch v3 uses ESM

    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'audio/ogg' });
    formData.append('file', blob, 'audio.ogg');

    try {
        const start = Date.now();
        const res = await fetch(LOCAL_URL, {
            method: 'POST',
            headers: { 'x-whisper-secret': LOCAL_SECRET },
            body: formData
        });
        const elapsed = (Date.now() - start) / 1000;
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        console.log(`Local Succeeded in ${elapsed}s: "${data.text}"`);
    } catch (e) {
        console.error(`Local Failed: ${e.message}`);
    }
}

async function testCloudflare() {
    console.log('\n--- Testing Cloudflare AI ---');
    // Using wrangler to test Cloudflare AI might be easier if we have a worker.
    // Or just use curl directly from shell.
}

(async () => {
    await testLocal();
    // testCloudflare(); // Handled by shell script for convenience
})();
