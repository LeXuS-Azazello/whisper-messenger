import fs from 'fs';
import { transcribe } from './transcribe.js';

async function test() {
    const audioPath = './test.ogg';
    if (!fs.existsSync(audioPath)) {
        console.error(`File ${audioPath} not found!`);
        process.exit(1);
    }

    const audioBuffer = fs.readFileSync(audioPath);
    console.log(`Testing transcription with ${audioPath} (${audioBuffer.length} bytes)...`);

    const config = {
        qwenUrl: process.env.QWEN_ASR_URL || 'http://qwen3-asr:8000',
        secret: process.env.BRIDGE_SECRET || ''
    };

    try {
        const result = await transcribe(audioBuffer, 'audio/ogg', config);
        console.log('Transcription Result:', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Transcription failed:', e.message);
    }
}

test();
