import fs from 'fs';
import { processFile } from './src/asr.js';

async function main() {
  process.env.ASR_MODEL_TYPE = "sensevoice";
  process.env.MODELS_DIR = "/models";
  process.env.NUM_THREADS = "4";
  
  import('child_process').then(cp => {
    cp.execSync('ffmpeg -y -hide_banner -loglevel error -f lavfi -i "sine=frequency=1000:duration=3" -c:a pcm_s16le -ar 16000 -ac 1 test.wav');
    processFile('test.wav', '').then(res => {
      console.log("RESULT:", res);
      process.exit(0);
    }).catch(e => {
      console.error("ERROR:", e);
      process.exit(1);
    });
  });
}
main();
