import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { TELEGRAM_BOT_TOKEN } from './config.js';

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

console.log(`[bot-test] Starting bot with token ${TELEGRAM_BOT_TOKEN.split(':')[0]}...`);

async function transcribeAudio(audioBuffer, mimeType) {
    const url = process.env.WHISPER_PROVIDER || 'http://whisper-turbo.debugging-testcrash-pub.svc.cluster.local:8000';
    console.log(`[bot-test] 🤖 Using Whisper Turbo at ${url}`);
    
    const startTime = Date.now();

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, 'audio.ogg');
    formData.append('language', 'auto');

    const response = await fetch(`${url}/v1/audio/transcriptions`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Whisper Turbo error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const text = data.text || data.transcription || '';
    const duration = (Date.now() - startTime) / 1000;

    return { text, duration };
}

bot.on(message('voice'), async (ctx) => {
    const voice = ctx.message.voice;
    console.log(`[bot-test] 🎤 Voice message from ${ctx.from.id}`);

    try {
        const statusMsg = await ctx.reply('⏳ Transcribing audio...', { reply_to_message_id: ctx.message.message_id });
        
        const fileId = voice.file_id;
        const link = await ctx.telegram.getFileLink(fileId);
        
        console.log(`[bot-test] ⏳ Downloading file from ${link.href}...`);
        const response = await fetch(link.href);
        const buffer = Buffer.from(await response.arrayBuffer());
        
        console.log(`[bot-test] 💾 Downloaded ${buffer.length} bytes. Starting transcription...`);
        const result = await transcribeAudio(buffer, 'audio/ogg');
        const text = result.text;
        const duration = result.duration;

        if (!text || text.trim().length === 0) {
            await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, '❌ Could not transcribe audio (empty result).');
            return;
        }

        console.log(`[bot-test] ✅ Transcribed (${duration.toFixed(1)}s): "${text.slice(0, 100)}..."`);
        
        const fullText = `🎤 ${text}\n\n⏱️ ${duration.toFixed(1)}s`;
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, fullText);
        
    } catch (e) {
        console.error('[bot-test] Error processing voice:', e);
        ctx.reply(`❌ Error processing voice message: ${e.message}`).catch(() => {});
    }
});

bot.on(message('video_note'), async (ctx) => {
    const videoNote = ctx.message.video_note;
    console.log(`[bot-test] 📹 Video note from ${ctx.from.id}`);

    try {
        const statusMsg = await ctx.reply('⏳ Transcribing audio from video note...', { reply_to_message_id: ctx.message.message_id });
        
        const fileId = videoNote.file_id;
        const link = await ctx.telegram.getFileLink(fileId);
        
        const response = await fetch(link.href);
        const buffer = Buffer.from(await response.arrayBuffer());
        
        const result = await transcribeAudio(buffer, 'video/mp4');
        const text = result.text;
        const duration = result.duration;

        if (!text || text.trim().length === 0) {
            await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, '❌ Could not transcribe audio.');
            return;
        }

        const fullText = `📹 ${text}\n\n⏱️ ${duration.toFixed(1)}s`;
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, fullText);
        
    } catch (e) {
        console.error('[bot-test] Error processing video note:', e);
        ctx.reply(`❌ Error processing video note: ${e.message}`).catch(() => {});
    }
});

bot.launch();
console.log('[bot-test] Bot is running...');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
