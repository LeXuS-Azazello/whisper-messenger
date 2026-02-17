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
echo "2. Configure Meta Webhook URL to: https://whisper.debug.org.ua"
echo "3. Set VERIFY_TOKEN in Meta Developer Portal matching your input"
echo "4. Subscribe to 'messages' webhook event"
