#!/bin/bash
set -euo pipefail

echo "=== Echo Messenger Wrangler Setup ==="
echo ""

# Install wrangler if not present
if ! command -v wrangler &> /dev/null; then
    echo "Installing wrangler..."
    npm install -g wrangler
else
    echo "Wrangler already installed: $(wrangler --version)"
fi

# Login
echo ""
echo ">>> Running: wrangler login"
wrangler login

# Create Wrangler project (if not exists)
echo ""
echo ">>> Initializing Wrangler project..."
if [ ! -f "wrangler.toml" ]; then
    wrangler init echo-messenger-worker --type=hello-world --yes 2>/dev/null || true
fi

# Check KV namespace
echo ""
echo ">>> Checking KV namespace..."
KV_ID=$(wrangler kv namespace list 2>/dev/null | grep "echo-messenger-stats" | awk '{print $1}' || echo "")
if [ -z "$KV_ID" ]; then
    echo "Creating KV namespace: echo-messenger-stats"
    wrangler kv namespace create echo-messenger-stats
else
    echo "KV namespace already exists: $KV_ID"
fi

echo ""
echo "=== Wrangler Setup Complete ==="
echo ""
echo "To login to Cloudflare:"
echo "  wrangler login"
echo ""
echo "To check login status:"
echo "  wrangler whoami"
echo ""
echo "To deploy worker:"
echo "  wrangler deploy"
echo ""
echo "To tail logs:"
echo "  wrangler tail echo-messenger-worker"
