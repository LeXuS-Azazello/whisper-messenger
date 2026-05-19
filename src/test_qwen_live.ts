import { transcribeWithFallback } from './whisper';
import { sampleAudioBase64 } from './sample_audio';

// Mock Env for internal cluster testing
const mockEnv = {
  STATS: {
    get: async (key: string) => {
      if (key === 'config_local_whisper_url') return process.env.WHISPER_URL || 'http://whisper-service.debugging-testcrash-pub.svc.cluster.local:8000';
      return null;
    },
  },
  WHISPER_PROVIDER: process.env.WHISPER_URL || 'http://whisper-service.debugging-testcrash-pub.svc.cluster.local:8000',
} as any;

async function runTest() {
  console.log('Testing Whisper Turbo Transcription...');
  console.log('Target URL:', mockEnv.WHISPER_PROVIDER);
  
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
