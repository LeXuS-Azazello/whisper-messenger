import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

// --- Configuration ---
const BOT_TOKEN = process.env.PAYMENT_BOT_TOKEN || 'PLACEHOLDER_BOT_TOKEN';
const PROVIDER_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN || 'PLACEHOLDER_PROVIDER_TOKEN'; 
const CRYPTO_PAY_TOKEN = process.env.CRYPTO_PAY_TOKEN || 'PLACEHOLDER_CRYPTO_PAY_TOKEN';

let bot: TelegramBot | null = null;

if (BOT_TOKEN !== 'PLACEHOLDER_BOT_TOKEN') {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    console.log('🤖 [PaymentBot] Started polling for payments...');

    bot.onText(/\/start(.*)/, async (msg, match) => {
        const chatId = msg.chat.id;
        
        let payload = '';
        if (match && match[1]) {
            payload = match[1].trim(); // e.g. "12345" or "sub_weekly_12345"
        }

        if (!payload) {
            return bot?.sendMessage(chatId, '❌ *Error:* Account not linked. Please use the payment button directly from your dashboard.', { parse_mode: 'Markdown' });
        }

        // Determine if it's a subscription or a top-up
        let text = '';
        let amount = 10; // Default Top-Up Amount
        let title = 'Balance Top-Up';
        let action = `topup_${payload}`;

        if (payload.startsWith('sub_weekly_')) {
            title = 'Weekly Unlimited Plan';
            amount = 1;
            action = payload;
            text = `🌟 *Upgrade to Weekly Unlimited*\n\nPrice: *$1*\n\nUnlock unlimited transcriptions, translations, and words for 7 days. Select a payment method below:`;
        } else if (payload.startsWith('sub_monthly_')) {
            title = 'Monthly Unlimited Plan';
            amount = 2;
            action = payload;
            text = `💎 *Upgrade to Monthly Unlimited*\n\nPrice: *$2*\n\nGet priority queue and premium support along with all unlimited features. Select a payment method below:`;
        } else if (payload.startsWith('sub_flexible_')) {
            title = 'Flexible Daytime Plan';
            amount = 14.99;
            action = payload;
            text = `☀️ *Upgrade to Flexible Plan*\n\nPrice: *$14.99*\n\nUnlimited access from 08:00 to 20:00. Select a payment method below:`;
        } else {
            // General Top-Up (payload is just userId)
            title = 'Account Balance Top-Up';
            action = `topup_${payload}`;
            text = `💳 *Account Top-Up*\n\nAdd funds to your Echo Messenger account to pay for Pay-As-You-Go features.\n\nSelect top-up amount and payment method:`;
        }

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `💳 Pay with Card ($${amount})`, callback_data: `pay_card_${action}_${amount}` }
                ],
                [
                    { text: `🪙 Pay with Crypto (USDT)`, callback_data: `pay_crypto_${action}_${amount}` }
                ],
                [
                    { text: '🌐 Back to Dashboard', url: 'https://voicemsg.net/dashboard' }
                ]
            ]
        };

        bot?.sendMessage(chatId, text, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    });

    bot.on('callback_query', async (query) => {
        const chatId = query.message?.chat.id;
        if (!chatId) return;

        const data = query.data || '';
        // Format: pay_card_{action}_{amount}  OR pay_crypto_{action}_{amount}
        // action might contain underscores, e.g. "topup_12345" or "sub_weekly_12345"

        if (data.startsWith('pay_card_') || data.startsWith('pay_crypto_')) {
            const isCrypto = data.startsWith('pay_crypto_');
            const parts = data.split('_');
            
            // Extract amount (last part)
            const amountStr = parts.pop() || '10';
            const amount = parseFloat(amountStr);

            // Reconstruct action string
            // parts for card: ["pay", "card", "sub", "weekly", "12345"]
            const prefixLen = isCrypto ? 2 : 2; 
            const actionParts = parts.slice(prefixLen);
            const action = actionParts.join('_'); // e.g., "topup_12345" or "sub_weekly_12345"
            
            let title = 'Balance Top-Up';
            let description = 'Top up your account balance.';
            
            if (action.startsWith('sub_weekly_')) { title = 'Weekly Unlimited Plan'; description = '7 days of unlimited transcription and translation.'; }
            if (action.startsWith('sub_monthly_')) { title = 'Monthly Unlimited Plan'; description = '30 days of unlimited transcription, translation + premium support.'; }
            if (action.startsWith('sub_flexible_')) { title = 'Flexible Plan'; description = 'Unlimited access during daytime (08:00 - 20:00).'; }

            if (isCrypto) {
                bot?.sendMessage(chatId, '⏳ *Generating Crypto invoice...*', { parse_mode: 'Markdown' });
                
                try {
                    const res = await axios.post(
                        'https://pay.crypt.bot/api/createInvoice',
                        {
                            asset: 'USDT',
                            amount: amount.toString(),
                            description: description,
                            payload: `crypto_${action}`
                        },
                        { headers: { 'Crypto-Pay-API-Token': CRYPTO_PAY_TOKEN } }
                    );

                    if (res.data && res.data.ok) {
                        const payUrl = res.data.result.pay_url;
                        const cryptoKeyboard = {
                            inline_keyboard: [[{ text: '🔗 Open CryptoBot Invoice', url: payUrl }]]
                        };
                        bot?.sendMessage(chatId, `✅ *Invoice Created!*\n\nAmount: *$${amount} USDT*\n\nTap the button below to complete the payment securely via CryptoBot:`, {
                            parse_mode: 'Markdown',
                            reply_markup: cryptoKeyboard
                        });
                    } else {
                        bot?.sendMessage(chatId, '❌ Could not generate crypto invoice. Try again later.');
                    }
                } catch (e: any) {
                    console.error('[PaymentBot] Error creating crypto invoice:', e.message);
                    bot?.sendMessage(chatId, '⚠️ Crypto payments are currently unavailable. Check CRYPTO_PAY_TOKEN.');
                }
            } else {
                // Card Payment via Telegram
                const providerToken = PROVIDER_TOKEN;
                const currency = 'USD'; 
                const prices = [{ label: title, amount: Math.round(amount * 100) }]; // amount in cents

                try {
                    await bot?.sendInvoice(chatId, title, description, action, providerToken, currency, prices, {
                        need_email: true,
                        send_phone_number_to_provider: false,
                        send_email_to_provider: true,
                        photo_url: 'https://voicemsg.net/favicon.svg', // Branding
                        photo_width: 512,
                        photo_height: 512
                    });
                } catch (e: any) {
                    console.error('[PaymentBot] Error sending card invoice:', e.message);
                    bot?.sendMessage(chatId, '⚠️ Card payments are currently unavailable. Check PROVIDER_TOKEN.');
                }
            }
        }

        bot?.answerCallbackQuery(query.id);
    });

    bot.on('pre_checkout_query', (query) => {
        bot?.answerPreCheckoutQuery(query.id, true);
    });

    bot.on('successful_payment', async (msg) => {
        const payload = msg.successful_payment?.invoice_payload;
        console.log('[PaymentBot] Successful payment received! Payload:', payload);

        if (!payload) return;

        let userId = '';
        let planAdded = '';
        let amountAdded = (msg.successful_payment?.total_amount || 0) / 100;

        if (payload.startsWith('topup_')) {
            userId = payload.replace('topup_', '');
        } else if (payload.startsWith('sub_weekly_')) {
            userId = payload.replace('sub_weekly_', '');
            planAdded = 'Weekly Unlimited';
        } else if (payload.startsWith('sub_monthly_')) {
            userId = payload.replace('sub_monthly_', '');
            planAdded = 'Monthly Unlimited';
        } else if (payload.startsWith('sub_flexible_')) {
            userId = payload.replace('sub_flexible_', '');
            planAdded = 'Flexible (Daytime)';
        }

        if (userId) {
            try {
                // Use dynamic import to avoid potential circular dependencies early in boot
                const { default: User } = await import('../src/object-models/User');
                const dbUser = await User.findOne({ userId });
                
                if (dbUser) {
                    if (planAdded) {
                        dbUser.currentPlan = planAdded;
                        console.log(`[PaymentBot] User ${userId} upgraded to ${planAdded}`);
                    } else {
                        dbUser.balance = (dbUser.balance || 0) + amountAdded;
                        console.log(`[PaymentBot] Added $${amountAdded} to user ${userId} balance`);
                    }
                    await dbUser.save();
                    
                    // Note: Redis KV will be naturally eventually consistent on next request, 
                    // or we could update Redis here if we passed env, but standard DB save is safe.
                }
            } catch (err) {
                console.error('[PaymentBot] Error updating DB after payment:', err);
            }
        }

        const successText = planAdded 
            ? `🎉 *Payment Successful!*\n\nYou have been successfully upgraded to the *${planAdded}* plan.\nEnjoy your premium features!`
            : `🎉 *Payment Successful!*\n\n*$${amountAdded}* has been successfully added to your balance.\nThank you for using Echo Messenger!`;

        bot?.sendMessage(msg.chat.id, successText, { parse_mode: 'Markdown' });
    });

} else {
    console.warn('⚠️ [PaymentBot] BOT_TOKEN is missing or placeholder. Payment bot is disabled.');
}
