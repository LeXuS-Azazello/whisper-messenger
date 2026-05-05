#!/bin/bash
# =============================================================================
# CLOUDFLARE TUNNEL SETUP - Docker Container
# =============================================================================
# Domain: voicemsg.net
# Purpose: Start Cloudflare tunnel using Docker (no systemd needed)
# Token: eyJhIjoiZmZhMjc2NTFhNjQ3ZDM3YTcxZmIzYWVhZTk2OWM3NjIiLCJ0Ijoi...
# =============================================================================

set -e

echo "============================================="
echo "  CLOUDFLARE TUNNEL SETUP (Docker)"
echo "============================================="
echo ""

TUNNEL_TOKEN="eyJhIjoiZmZhMjc2NTFhNjQ3ZDM3YTcxZmIzYWVhZTk2OWM3NjIiLCJ0IjoiM2Y5ZGViYTEtNjdmOC00MDg2LWI2ZDAtZjE2NzU5Y2NhOWQ2IiwicyI6IlI4Z1ZIODdjRWN0UjZQTEozdlAvcFJFQm1LTmVyUWx3YTJCSjR6UVFRRG89In0="

echo "Step 1: Stop existing tunnel container..."
docker stop cloudflared-tunnel 2>/dev/null || true
docker rm cloudflared-tunnel 2>/dev/null || true
echo "✅ Stopped existing container"
echo ""

echo "Step 2: Pull latest cloudflared image..."
docker pull cloudflare/cloudflared:latest
echo "✅ Image pulled"
echo ""

echo "Step 3: Start tunnel container..."
docker run -d \
  --name cloudflared-tunnel \
  --restart unless-stopped \
  cloudflare/cloudflared:latest \
  tunnel \
  --no-autoupdate \
  run \
  --token "${TUNNEL_TOKEN}"

echo "✅ Tunnel container started"
echo ""

echo "Step 4: Wait for tunnel to connect..."
sleep 5

if docker logs cloudflared-tunnel 2>&1 | grep -q "Connection established"; then
    echo "✅ Tunnel connected successfully!"
else
    echo "⚠️  Tunnel may still be connecting..."
    echo "   Check logs: docker logs cloudflared-tunnel"
fi

echo ""
echo "============================================="
echo "  TUNNEL STATUS"
echo "============================================="
docker ps --filter "name=cloudflared-tunnel" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "To view logs: docker logs -f cloudflared-tunnel"
echo "To stop: docker stop cloudflared-tunnel"
echo "============================================="
echo ""
echo "📋 Next Steps:"
echo "   1. Update k8s.yaml with CLOUDFLARED_TOKEN"
echo "   2. kubectl apply -f k8s.yaml"
echo "   3. npm run deploy:worker"
echo "============================================="

