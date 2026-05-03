#!/bin/bash

# Cloudflare Worker Setup Script
# Run this script to configure secrets for whisper-messenger

echo "🔧 Setting up whisper-messenger secrets..."

# Function to set secret
set_secret() {
    local name=$1
    local value=$2
    if [ -z "$value" ]; then
        read -p "Enter $name: " value
    fi
    if [ -n "$value" ]; then
        echo "$value" | wrangler secret put "$name"
        echo "✅ Set $name"
    else
        echo "⚠️  Skipped $name (empty value)"
    fi
}

# Set secrets
echo ""
echo "=== Meta API Configuration ==="

if [ -z "$VERIFY_TOKEN" ]; then
    read -p "Enter VERIFY_TOKEN (for Meta webhook verification): " VERIFY_TOKEN
fi
set_secret "VERIFY_TOKEN" "$VERIFY_TOKEN"

if [ -z "$META_PAGE_TOKEN" ]; then
    read -p "Enter META_PAGE_TOKEN (Meta Page Access Token): " META_PAGE_TOKEN
fi
set_secret "META_PAGE_TOKEN" "$META_PAGE_TOKEN"

if [ -z "$META_APP_SECRET" ]; then
    read -p "Enter META_APP_SECRET (Meta App Secret for webhook signature verification): " META_APP_SECRET
fi
set_secret "META_APP_SECRET" "$META_APP_SECRET"

if [ -z "$WHATSAPP_TOKEN" ]; then
    read -p "Enter WHATSAPP_TOKEN (WhatsApp Permanent Access Token): " WHATSAPP_TOKEN
fi
set_secret "WHATSAPP_TOKEN" "$WHATSAPP_TOKEN"

echo ""
echo "=== Telegram API Configuration ==="

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    read -p "Enter TELEGRAM_BOT_TOKEN (e.g. 123456:ABC-DEF...): " TELEGRAM_BOT_TOKEN
fi
set_secret "TELEGRAM_BOT_TOKEN" "$TELEGRAM_BOT_TOKEN"

echo ""
echo "=== Admin Panel Configuration ==="
if [ -z "$ADMIN_SECRET" ]; then
    read -p "Enter ADMIN_SECRET (Your master password for /admin dashboard): " ADMIN_SECRET
fi
set_secret "ADMIN_SECRET" "$ADMIN_SECRET"

echo ""
echo "=== Deployment ==="
read -p "Deploy worker now? (y/n): " deploy
if [ "$deploy" = "y" ] || [ "$deploy" = "Y" ]; then
    npm run deploy
    echo ""
    echo "✅ Deployment complete!"

    # Telegram Webhook post-deployment
    if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
        echo ""
        read -p "Set Telegram Webhook automatically now? (y/n): " set_tw
        if [ "$set_tw" = "y" ] || [ "$set_tw" = "Y" ]; then
            read -p "Enter your Worker URL (e.g. https://voicemsg.net): " worker_url
            if [ -n "$worker_url" ]; then
                echo "Setting Telegram Webhook to $worker_url..."
                curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${worker_url}"
                echo ""
                echo "✅ Telegram Webhook set!"
            fi
        fi
    fi
else
    echo "Run 'npm run deploy' manually when ready."
fi

echo ""
echo "=== Next Steps ==="
echo "1. Add custom domain 'voicemsg.net' in Cloudflare Dashboard"
echo "2. Configure Meta Webhook Callback URL to: https://voicemsg.net"
echo "3. Set VERIFY_TOKEN in Meta Developer Portal to match this worker secret"
echo "4. Subscribe webhooks:"
echo "   - Messenger/Instagram: messages, messaging_postbacks, messaging_optins"
echo "   - WhatsApp: messages"
echo "   - Telegram: (already set if you followed prompts)"
echo ""
echo "=== mTLS Setup (already configured) ==="
echo "mTLS is configured for voicemsg.net with DigiCert CA certificates."
echo "Uploaded CAs:"
echo "  - DigiCert Global Root G2  (id: 51f59d03-032d-4999-83d4-5bf4b073060f)"
echo "  - DigiCert Global Root CA  (id: 1a044ac7-a4c3-4054-b641-86c556d81ced)"
echo ""
echo "To reconfigure mTLS:"
echo "  1. Upload CA:  wrangler cert upload certificate-authority --ca-cert <path.pem> --name <name>"
echo "  2. Associate:  curl -X PUT https://api.cloudflare.com/client/v4/zones/ZONE_ID/certificate_authorities/hostname_associations"
echo "     with body: {\"hostnames\":[\"voicemsg.net\"],\"mtls_certificate_id\":\"CERT_ID\"}"
echo "  3. The worker verifies Meta's client certificate CN=client.webhooks.fbclientcerts.com"
