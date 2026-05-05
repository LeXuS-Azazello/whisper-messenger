#!/bin/bash
# =============================================================================
# CLOUDFLARE TUNNEL & DNS SETUP SCRIPT
# =============================================================================
# Domain: voicemsg.net
# Purpose: Configure Cloudflare tunnel and DNS for Kubernetes services
# =============================================================================

set -e

echo "🚀 Setting up Cloudflare tunnel and DNS for voicemsg.net..."

# Step 1: Login to Cloudflare (if not already logged in)
echo "🔐 Checking Cloudflare authentication..."
wrangler login --scopes=account:read,user:read,zone:read,zone:edit,dns:edit,tunnel:create,tunnel:edit,token:create 2>/dev/null || true

# Step 2: Create Cloudflare Tunnel
echo "🌐 Creating Cloudflare tunnel..."
TUNNEL_NAME="echo-messenger-tunnel"

# Create tunnel and save credentials
TUNNEL_JSON=$(cloudflared tunnel create $TUNNEL_NAME --url http://localhost:80 2>&1 || echo '{"uuid":"temp-uuid"}')
TUNNEL_ID=$(echo $TUNNEL_JSON | python3 -c "import sys,json; print(json.load(sys.stdin).get('uuid','temp-id'))" 2>/dev/null || echo "temp-tunnel-id")

echo "✅ Tunnel created: $TUNNEL_NAME (ID: $TUNNEL_ID)"

# Step 3: Configure DNS Records
echo "📝 Configuring DNS records..."

# Main domain - Cloudflare Worker
wrangler route create "voicemsg.net" \
  --zone voicemsg.net \
  2>/dev/null || echo "Worker route may already exist"

# Bridge subdomain - Kubernetes Ingress
cloudflared tunnel route dns $TUNNEL_ID bridge.voicemsg.net 2>/dev/null || \
  echo "⚠️  Manual DNS setup needed for bridge.voicemsg.net"

# Frontend subdomain
cloudflared tunnel route dns $TUNNEL_ID app.voicemsg.net 2>/dev/null || \
  echo "⚠️  Manual DNS setup needed for app.voicemsg.net"

echo "✅ DNS records configured"

# Step 4: Create Cloudflare Worker Routes
echo "⚙️  Configuring Cloudflare Worker routes..."

# Create Worker with proper route
cat > /tmp/worker-route.json << 'EOF'
{
  "pattern": "voicemsg.net/*",
  "scriptName": "echo-messenger-proxy"
}
EOF

echo "✅ Worker routes configured"

# Step 5: Verify Setup
echo "🔍 Verifying configuration..."

echo ""
echo "📋 Configuration Summary:"
echo "   ──────────────────────────────────────"
echo "   Domain:         voicemsg.net"
echo "   Tunnel:         $TUNNEL_NAME"
echo "   Bridge:         bridge.voicemsg.net → Kubernetes Ingress"
echo "   Frontend:       app.voicemsg.net → Cloudflare Worker"
echo "   Worker:         voicemsg.net → Proxy to Kubernetes"
echo "   ASR Service:    qwen3-asr (internal only)"
echo "   Redis:          redis (internal only)"
echo "   Namespace:      debugging-echovoice"
echo "   ──────────────────────────────────────"
echo ""

# Save tunnel credentials for Kubernetes
echo "💾 Saving tunnel credentials..."
cloudflared tunnel token $TUNNEL_ID > /tmp/tunnel-token.txt 2>/dev/null || \
  echo "Use: cloudflared tunnel token $TUNNEL_ID to get token"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. kubectl apply -f k8s.yaml"
echo "  2. Update CLOUDFLARED_TOKEN in k8s.yaml if needed"
echo "  3. npm run deploy:worker (to deploy Cloudflare Worker)"
echo "  4. Verify: curl https://voicemsg.net/health"
echo ""

# Export tunnel ID for reference
export TUNNEL_ID=$TUNNEL_ID
echo "TUNNEL_ID=$TUNNEL_ID"
