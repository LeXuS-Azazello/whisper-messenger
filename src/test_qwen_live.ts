import { transcribeWithFallback } from './whisper';
import { sampleAudioBase64 } from './sample_audio';

// Mock Env for internal cluster testing
const mockEnv = {
  STATS: {
    get: async (key: string) => {
      if (key === 'config_whisper_provider') return 'qwen3-asr';
      if (key === 'config_ollama_url') return process.env.QWEN_URL || 'http://100.65.0.209:11434';
      return null;
    },
  },
  OLLAMA_BASE_URL: process.env.QWEN_URL || 'http://100.65.0.209:11434',
} as any;

async function runTest() {
  console.log('Testing Qwen3-ASR Transcription...');
  console.log('Target URL:', mockEnv.OLLAMA_BASE_URL);
  
  const audioBuffer = Buffer.from(sampleAudioBase64.split(',')[1], 'base64').buffer;
  
  try {
    const start = Date.now();
    const result = await transcribeWithFallback(audioBuffer, mockEnv);
    const duration = Date.now() - start;
    
    console.log('\n✅ Success!');
    console.log('Duration:', duration, 'ms');
    console.log('Result:', result.text);
    console.log('Model Used:', result.model);
  } catch (e: any) {
    console.error('\n❌ Transcription Failed');
    console.error('Error:', e.message);
    if (e.stack) console.error(e.stack);
  }
}

runTest();
