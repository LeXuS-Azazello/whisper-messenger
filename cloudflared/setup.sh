#!/bin/bash
set -euo pipefail

echo "=== Echo Messenger Cloudflare Tunnel Setup ==="

# Authenticate with Cloudflare
echo ">>> Running: wrangler login"
wrangler login

# Authenticate with cloudflared
echo ">>> Authenticate cloudflared with Cloudflare account"
cloudflared tunnel login

# Create the tunnel (or use existing one)
TUNNEL_ID="9dc709ab-af10-4c4c-8227-d5066909a67c"
echo ">>> Using tunnel: $TUNNEL_ID"

# Download credentials
echo ">>> Downloading tunnel credentials"
CRED_DIR="/home/lexus/projects/telegramBots/fb_insta_voice_msg/cloudflared"
cloudflared tunnel token $TUNNEL_ID > "$CRED_DIR/credentials.json" 2>/dev/null || true

# Run DNS setup
echo ">>> Setting up DNS records for voicemsg.net"

# Main domain -> tunnel
cloudflared tunnel route dns $TUNNEL_ID voicemsg.net || true

# Subdomains -> tunnel
cloudflared tunnel route dns $TUNNEL_ID bridge.voicemsg.net || true
cloudflared tunnel route dns $TUNNEL_ID asr.voicemsg.net || true
cloudflared tunnel route dns $TUNNEL_ID grafana.voicemsg.net || true
cloudflared tunnel route dns $TUNNEL_ID redis.voicemsg.net || true

echo ""
echo "=== Setup complete! ==="
echo "To start the tunnel, run:"
echo "  cloudflared tunnel run --config cloudflared/config.yaml $TUNNEL_ID"
echo ""
echo "Tunnel ID: $TUNNEL_ID"