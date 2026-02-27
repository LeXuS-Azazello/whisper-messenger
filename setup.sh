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
echo "=== Deployment ==="
read -p "Deploy worker now? (y/n): " deploy
if [ "$deploy" = "y" ] || [ "$deploy" = "Y" ]; then
    npm run deploy
    echo ""
    echo "✅ Deployment complete!"
else
    echo "Run 'npm run deploy' manually when ready."
fi

echo ""
echo "=== Next Steps ==="
echo "1. Add custom domain 'whisper.debug.org.ua' in Cloudflare Dashboard"
echo "2. Configure Meta Webhook Callback URL to: https://whisper.debug.org.ua"
echo "3. Set VERIFY_TOKEN in Meta Developer Portal to match this worker secret"
echo "4. Subscribe webhooks:"
echo "   - Messenger/Instagram: messages, messaging_postbacks, messaging_optins"
echo "   - WhatsApp: messages"
echo ""
echo "=== mTLS Setup (already configured) ==="
echo "mTLS is configured for whisper.debug.org.ua with DigiCert CA certificates."
echo "Uploaded CAs:"
echo "  - DigiCert Global Root G2  (id: 51f59d03-032d-4999-83d4-5bf4b073060f)"
echo "  - DigiCert Global Root CA  (id: 1a044ac7-a4c3-4054-b641-86c556d81ced)"
echo ""
echo "To reconfigure mTLS:"
echo "  1. Upload CA:  wrangler cert upload certificate-authority --ca-cert <path.pem> --name <name>"
echo "  2. Associate:  curl -X PUT https://api.cloudflare.com/client/v4/zones/ZONE_ID/certificate_authorities/hostname_associations"
echo "     with body: {\"hostnames\":[\"whisper.debug.org.ua\"],\"mtls_certificate_id\":\"CERT_ID\"}"
echo "  3. The worker verifies Meta's client certificate CN=client.webhooks.fbclientcerts.com"
