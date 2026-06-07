import { redis } from './config.js';
import { TARGET_USER_ID, MANAGER_URL, MANAGER_SECRET } from './config.js';

export async function safeSendMessage(client, chatId, replyToMessageId, text, attempt = 1) {
    try {
        const result = await client.invoke({
            '_': 'sendMessage',
            chat_id: chatId,
            reply_to_message_id: replyToMessageId,
            input_message_content: {
                '_': 'inputMessageText',
                text: {
                    '_': 'formattedText',
                    text: text
                }
            }
        });
        return result;
    } catch (err) {
        const errorMsg = err.message || '';
        if (errorMsg.includes('FLOOD_WAIT_') && attempt <= 3) {
            const match = errorMsg.match(/FLOOD_WAIT_(\d+)/);
            const waitSeconds = match ? parseInt(match[1], 10) : 5;
            console.warn(`[messenger] ⚠️ FLOOD_WAIT. Waiting ${waitSeconds}s (attempt ${attempt}/3)...`);
            await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000 + 500));
            return safeSendMessage(client, chatId, replyToMessageId, text, attempt + 1);
        }
        throw err;
    }
}

export function startChatAction(client, chatId, action = 'chatActionTyping') {
    let active = true;
    
    const send = async () => {
        if (!active) return;
        try {
            await client.invoke({
                '_': 'sendChatAction',
                'chat_id': chatId,
                'message_thread_id': 0,
                'action': { '_': action }
            });
        } catch (e) {
            // Ignore errors
        }
    };
    
    send();
    const interval = setInterval(send, 4000);
    
    return {
        stop: () => {
            active = false;
            clearInterval(interval);
            try {
                client.invoke({
                    '_': 'sendChatAction',
                    'chat_id': chatId,
                    'message_thread_id': 0,
                    'action': { '_': 'chatActionCancel' }
                }).catch(() => {});
            } catch (e) {}
        }
    };
}

export async function deleteMessage(client, chatId, messageId) {
    if (!messageId) return;
    try {
        await client.invoke({
            '_': 'deleteMessages',
            chat_id: chatId,
            message_ids: [messageId],
            revoke: true
        });
        console.log(`[messenger] 🗑️ Deleted message ${messageId} in chat ${chatId}`);
    } catch (deleteErr) {
        console.warn(`[messenger] Failed to delete message ${messageId}:`, deleteErr.message);
    }
}

export async function updateManagerStats(userId) {
    const managerApi = MANAGER_URL || 'http://tg-client-manager:3000';
    if (!MANAGER_SECRET) {
        console.error('[messenger] MANAGER_SECRET not set, cannot update stats');
        return;
    }
    const secret = MANAGER_SECRET;
    fetch(`${managerApi}/internal/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-manager-secret': secret },
        body: JSON.stringify({ userId, secret })
    }).catch(e => console.error('[messenger] Failed to update stats:', e.message));
}
