import { createClient } from 'redis';
async function main() {
  const client = createClient({ url: 'redis://localhost:6379' });
  await client.connect();
  const keys = await client.keys('tg_session_*');
  console.log("KEYS:", keys);
  
  const val = await client.get('config_whisper_provider');
  console.log("OLD VALUE:", val);
  if (val === 'whisper-turbo' || val === 'whisper-service-v2' || val === 'http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000 whisper-turbo') {
    await client.set('config_whisper_provider', 'http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000');
    console.log("FIXED Redis");
  }
  process.exit(0);
}
main();
