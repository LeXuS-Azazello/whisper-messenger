const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_UI = path.join(ROOT, 'src', 'admin_ui.tsx');

const adminUiBuffer = fs.readFileSync(ADMIN_UI, 'utf-8');

const regex = /const sampleUrl = '(data:audio\/ogg;base64,[^']+)';/;
const match = adminUiBuffer.match(regex);

if (match) {
  const base64String = match[1];
  
  const sampleAudioContent = `export const sampleAudioBase64 = '${base64String}';\n`;
  const SAMPLE_AUDIO = path.join(ROOT, 'src', 'sample_audio.ts');
  fs.writeFileSync(SAMPLE_AUDIO, sampleAudioContent);
  
  const newAdminUiBuffer = adminUiBuffer.replace(
    /const sampleUrl = 'data:audio\/ogg;base64,[^']+';/,
    'const sampleUrl = sampleAudioBase64;'
  );
  
  // also add import at top of the <script> block inside renderAdminDashboard if we can, 
  // wait we can't just import in a client-side script tag unless it is bundled or type="module".
  // Actually, wait, since the JSX is evaluated on the server, we can inject the string literal!
  // It's a template string in dangerouslySetInnerHTML={{ __html: ` ... ` }}
  
  // Best way is to define it before renderAdminDashboard and inject it using ${sampleAudioBase64}
  const replacedWithVariable = adminUiBuffer.replace(
    /const sampleUrl = 'data:audio\/ogg;base64,[^']+';/,
    'const sampleUrl = `${sampleAudioBase64}`;'
  );
  
  const withImport = `import { sampleAudioBase64 } from './sample_audio';\n` + replacedWithVariable;
  
  fs.writeFileSync(ADMIN_UI, withImport);
  console.log("Audio extracted successfully!");
} else {
  console.log("Regex didn't match.");
}
