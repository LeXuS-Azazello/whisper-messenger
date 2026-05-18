#!/bin/bash
set -euo pipefail

echo "=== Echo Messenger Cloudflared Tunnel Setup ==="
echo ""

# Install cloudflared if not present
if ! command -v cloudflared &> /dev/null; then
    echo "Installing cloudflared..."
    if [[ "$(uname -m)" == "x86_64" ]]; then
        ARCH="amd64"
    elif [[ "$(uname -m)" == "aarch64" ]]; then
        ARCH="arm64"
    else
        ARCH="amd64"
    fi
    curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}" \
        -o /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
else
    echo "Cloudflared already installed: $(cloudflared --version)"
fi

# Login
echo ""
echo ">>> Running: cloudflared tunnel login"
cloudflared tunnel login

# Create tunnel
echo ""
echo ">>> Creating tunnel: echo-messenger-tunnel"
TUNNEL_ID=$(cloudflared tunnel create echo-messenger-tunnel 2>&1 | grep -oP 'Created tunnel \K[a-f0-9-]+' || echo "")

if [ -z "$TUNNEL_ID" ]; then
    echo "Tunnel may already exist. Listing existing tunnels..."
    cloudflared tunnel list
else
    echo "Created tunnel: $TUNNEL_ID"
fi

# Save credentials
echo ""
echo ">>> Saving tunnel credentials..."
mkdir -p cloudflared
cloudflared tunnel token echo-messenger-tunnel > cloudflared/credentials.json
echo "Credentials saved to cloudflared/credentials.json"

# Set up DNS routes
echo ""
DOMAIN="${DOMAIN:-voicemsg.net}"
NAMESPACE="${NAMESPACE:-debugging-testcrash-pub}"
echo ">>> Setting up DNS routes for ${DOMAIN}..."
cloudflared tunnel route dns echo-messenger-tunnel "${DOMAIN}" || true

echo ""
echo "=== Cloudflared Setup Complete ==="
echo ""
echo "To start the tunnel:"
echo "  cloudflared tunnel run --config cloudflared/config.yaml echo-messenger-tunnel"
echo ""
echo "To run as a service:"
echo "  sudo cloudflared service install"
echo "  # Then configure the config.yaml path in /etc/cloudflared/config.yaml"
echo ""
echo "To check DNS records:"
echo "  cloudflared tunnel route dns list"
echo ""
echo "To check tunnel status:"
echo "  cloudflared tunnel list"
