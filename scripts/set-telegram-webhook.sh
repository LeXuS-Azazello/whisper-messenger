#!/bin/bash

# Sets the Telegram Webhook for the bot
# Make sure .env is populated with TELEGRAM_BOT_TOKEN and WORKER_URL

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "$DIR/../.env"

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "Error: TELEGRAM_BOT_TOKEN not found in .env"
  exit 1
fi

if [ -z "$WORKER_URL" ]; then
  echo "Error: WORKER_URL not found in .env"
  exit 1
fi

WEBHOOK_URL="${WORKER_URL}/webhooks/telegram"

echo "Setting webhook to: $WEBHOOK_URL"

curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
     -H "Content-Type: application/json" \
     -d "{\"url\": \"${WEBHOOK_URL}\", \"allowed_updates\": [\"message\", \"callback_query\"]}"

echo -e "\nWebhook setup complete!"
