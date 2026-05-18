const fs = require('fs');
const path = '/home/lexus/projects/telegramBots/fb_insta_voice_msg/src/admin.js';
try {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
    console.log('Successfully deleted ' + path);
  } else {
    console.log('File does not exist: ' + path);
  }
} catch (e) {
  console.error('Failed to delete file:', e.message);
}
