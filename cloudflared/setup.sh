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
TUNNEL_NAME="echo-messenger-tunnel"
echo ">>> Looking for tunnel: $TUNNEL_NAME"
TUNNEL_ID=$(cloudflared tunnel list | grep -w "$TUNNEL_NAME" | awk '{print $1}' | head -n 1 || echo "")

if [ -z "$TUNNEL_ID" ]; then
  echo ">>> Creating new tunnel: $TUNNEL_NAME"
  TUNNEL_ID=$(cloudflared tunnel create "$TUNNEL_NAME" | grep -oP 'Created tunnel \K[a-f0-9-]+')
fi

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