# ECHO MESSENGER - DNS SETUP GUIDE

## Domain: voicemsg.net

## Overview

The Echo Messenger system uses Cloudflare Tunnel for secure ingress to Kubernetes services. This setup ensures:
- No direct Kubernetes API exposure
- DDoS protection via Cloudflare
- SSL/TLS termination at Cloudflare edge
- Internal DNS for cluster services

## DNS Configuration Options

### 🟢 Option 1: Cloudflare Tunnel (RECOMMENDED)

**Best for:** Production deployment with full security

**Setup Steps:**

1. **Run automated setup:**
   ```bash
   cd /home/lexus/projects/telegramBots/fb_insta_voice_msg
   ./scripts/dns-setup.sh
   ```

2. **Or manual setup:**

   a. Create Cloudflare Tunnel:
   ```bash
   cloudflared tunnel create echo-messenger-tunnel
   ```

   b. Get Tunnel ID:
   ```bash
   cloudflared tunnel list
   ```

   c. Create DNS records in Cloudflare Dashboard:
   ```
   Type: CNAME
   Name: bridge.voicemsg.net
   Target: <TUNNEL_ID>.cfargotunnel.com
   Proxy: Proxied (orange cloud) ✅
   TTL: Auto
   ```

   ```
   Type: CNAME
   Name: app.voicemsg.net
   Target: <TUNNEL_ID>.cfargotunnel.com
   Proxy: Proxied (orange cloud) ✅
   TTL: Auto
   ```

   ```
   Type: A
   Name: voicemsg.net
   Target: <WORKER_IP> (from Cloudflare Worker)
   Proxy: Proxied (orange cloud) ✅
   TTL: Auto
   ```

3. **Configure tunnel routing:**

   ```bash
   # Route to bridge subdomain
   cloudflared tunnel route dns <TUNNEL_NAME> bridge.voicemsg.net

   # Route to app subdomain
   cloudflared tunnel route dns <TUNNEL_NAME> app.voicemsg.net
   ```

4. **Update Kubernetes secret:**

   ```bash
   # Get tunnel token
   cloudflared tunnel token <TUNNEL_ID>

   # Update secret
   kubectl create secret generic cloudflared-tunnel-token \
     --namespace=debugging-echovoice \
     --from-literal=token="<TUNNEL_TOKEN>" \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

5. **Deploy Cloudflare Worker:**

   ```bash
   cd /home/lexus/projects/telegramBots/fb_insta_voice_msg
   npm run deploy:worker
   ```

**How It Works:**

```
User Request
     ↓
cloudflare.com (DNS)
     ↓
Cloudflare Edge (SSL/TLS)
     ↓
Cloudflare Tunnel (cloudflared)
     ↓
Kubernetes Ingress (bridge.voicemsg.net)
     ↓
MTProto Bridge Service
     ↓
User Pods (Dynamic)
```

**Benefits:**
- ✅ No public IP exposure
- ✅ DDoS protection
- ✅ SSL/TLS at edge
- ✅ Zero-trust networking
- ✅ Easy certificate management

---

### 🟡 Option 2: Direct DNS (Alternative)

**Use for:** Testing or when tunnel is unavailable

**Setup:**

1. Get Kubernetes Ingress IP:
   ```bash
   kubectl get svc -n debugging-echovoice
   # Look for EXTERNAL-IP on nginx-ingress
   ```

2. Create A record:
   ```
   Type: A
   Name: bridge.voicemsg.net
   Target: <INGRESS_IP>
   Proxy: DNS Only (grey cloud) ⚠️
   TTL: Auto
   ```

3. Enable SSL in ingress:
   ```yaml
   annotations:
     nginx.ingress.kubernetes.io/ssl-redirect: "true"
     nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
   ```

**Limitations:**
- ⚠️ Exposes ingress IP publicly
- ⚠️ Requires manual SSL certificate management
- ⚠️ No DDoS protection
- ⚠️ Less secure

**Only use for:**
- Initial testing
- Development environments
- When Cloudflare tunnel is down

---

### 🔴 Option 3: Load Balancer (Enterprise)

**Use for:** High-availability production

**Setup:**

1. Create Cloudflare Load Balancer
2. Configure backend pools
3. Set up health checks
4. Enable geo-routing
5. Configure failover policies

**Benefits:**
- Automatic failover
- Geographic routing
- Advanced health checks
- Multiple ingress controllers

**Cost:** Cloudflare Load Balancer pricing

---

## Current Configuration

### Files:
- `k8s.yaml` - Main Kubernetes config with ingress
- `kubernetes/cloudflared-tunnel.yaml` - Tunnel deployment
- `wrangler.toml` - Cloudflare Worker config
- `scripts/dns-setup.sh` - Automated DNS setup

### Services:
| Service | Internal | External | Protocol |
|---------|----------|----------|----------|
| Bridge Manager | bridge.voicemsg.net | Via tunnel | HTTP |
| Frontend | app.voicemsg.net | Via worker | HTTPS |
| Worker | voicemsg.net | Direct | HTTPS |
| Qwen3-ASR | qwen3-asr:11434 | Internal only | HTTP |
| Redis | redis:6379 | Internal only | TCP |

### Ingress Configuration:
```yaml
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /
  nginx.ingress.kubernetes.io/proxy-body-size: "10m"
  nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
  nginx.ingress.kubernetes.io/ssl-redirect: "false"
  nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
```

Note: SSL is handled by Cloudflare, not the ingress.

---

## Verification Steps

### 1. Check DNS Resolution:
```bash
dig bridge.voicemsg.net
# Should return: <TUNNEL_ID>.cfargotunnel.com

dig app.voicemsg.net  
# Should return: <TUNNEL_ID>.cfargotunnel.com
```

### 2. Check Cloudflare Tunnel:
```bash
cloudflared tunnel list
# Should show: echo-messenger-tunnel

cloudflared tunnel info <TUNNEL_NAME>
# Should show status: CONNECTED
```

### 3. Check Kubernetes Resources:
```bash
kubectl get pods -n debugging-echovoice
kubectl get svc -n debugging-echovoice
kubectl get ingress -n debugging-echovoice
```

### 4. Test Endpoints:
```bash
# Bridge health check
curl https://bridge.voicemsg.net/health
# Expected: {"mode":"MANAGER","alive":true}

# Worker health check
curl https://voicemsg.net/health
# Expected: {"ok":true}

# ASR service (via bridge)
curl https://bridge.voicemsg.net/api/completions
# Should proxy to qwen3-asr
```

### 5. Monitor Tunnel Logs:
```bash
kubectl logs -f deployment/cloudflared-tunnel -n debugging-echovoice

# Look for:
# "Connection established" 
# "Metrics for"
# No "connection closed" errors
```

---

## Troubleshooting

### DNS Not Resolving

**Symptom:** `dig bridge.voicemsg.net` returns different IP

**Solution:**
```bash
# Check Cloudflare DNS
cloudflared tunnel list

# Verify DNS record
curl -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $API_TOKEN"

# Update DNS
cloudflared tunnel route dns <TUNNEL_NAME> bridge.voicemsg.net
```

### Tunnel Not Connecting

**Symptom:** Cloudflare shows 1016 error

**Solution:**
```bash
# Check tunnel logs
kubectl logs -f deployment/cloudflared-tunnel -n debugging-echovoice

# Restart tunnel
kubectl rollout restart deployment/cloudflared-tunnel -n debugging-echovoice

# Verify token
cloudflared tunnel token <TUNNEL_ID>
```

### SSL Certificate Errors

**Symptom:** Browser shows SSL warning

**Solution:**
```bash
# Check Cloudflare SSL mode
# Should be: Full (strict) or Full

# Origin certificate
# Cloudflare auto-generates certs
# Ensure origin server has valid CA certs
```

### 502 Bad Gateway

**Symptom:** Cloudflare returns 502

**Solution:**
```bash
# Check backend service
kubectl get svc mtproto-bridge-manager -n debugging-echovoice

# Check pod health
kubectl get pods -l app=mtproto-bridge-manager -n debugging-echovoice

# Check readiness probe
kubectl describe pod <pod-name> -n debugging-echovoice
```

### Connection Timeout

**Symptom:** Requests timeout

**Solution:**
```bash
# Check ingress timeout settings
kubectl describe ingress mtproto-bridge-ingress -n debugging-echovoice

# Increase proxy timeout if needed:
nginx.ingress.kubernetes.io/proxy-read-timeout: "600"

# Check network policies
kubectl get networkpolicy -n debugging-echovoice
```

---

## Security Best Practices

### ✅ Do:
- Use Cloudflare Tunnel for all external access
- Enable Cloudflare WAF and DDoS protection
- Rotate tunnel tokens quarterly
- Monitor tunnel connections
- Use HTTPS for all endpoints
- Implement rate limiting

### ❌ Don't:
- Expose ingress IP publicly
- Disable SSL/TLS
- Use default tunnel tokens
- Allow direct node access
- Skip network policies

### Secret Rotation:
```bash
# Generate new tunnel
cloudflared tunnel create echo-messenger-tunnel-v2

# Update DNS
cloudflared tunnel route dns <NEW_TUNNEL> bridge.voicemsg.net

# Update Kubernetes secret
kubectl create secret generic cloudflared-tunnel-token \
  --namespace=debugging-echovoice \
  --from-literal=token="$(cloudflared tunnel token <NEW_TUNNEL>)" \
  --dry-run=client -o yaml | kubectl apply -f -

# Delete old tunnel
cloudflared tunnel delete <OLD_TUNNEL>
```

---

## Monitoring

### Cloudflare Dashboard:
- **Analytics → Traffic**: Request volume and patterns
- **Security → Events**: DDoS attacks and blocks
- **Network → Tunnels**: Tunnel status and health
- **SSL/TLS → Overview**: Certificate status

### Kubernetes:
```bash
# Tunnel health
kubectl get pods -n debugging-echovoice -l app=cloudflared-tunnel

# Ingress requests
kubectl logs -f deployment/cloudflared-tunnel -n debugging-echovoice

# Resource usage
kubectl top pods -n debugging-echovoice
```

### Alerts:
- Set up Cloudflare alerts for tunnel disconnection
- Monitor Kubernetes pod restarts
- Track SSL certificate expiration
- Alert on 5xx errors

---

## Maintenance

### Daily Checks:
- [ ] Tunnel status is CONNECTED
- [ ] DNS records point to correct tunnel
- [ ] No 5xx errors in last hour

### Weekly Tasks:
- [ ] Review Cloudflare security events
- [ ] Check certificate expiration dates
- [ ] Review access logs for anomalies

### Monthly Tasks:
- [ ] Rotate tunnel tokens
- [ ] Update Cloudflare WAF rules
- [ ] Review and update network policies
- [ ] Test disaster recovery

### Quarterly:
- [ ] Rotate all secrets
- [ ] Update Cloudflare plan if needed
- [ ] Review and optimize performance
- [ ] Security audit

---

## Quick Reference

### Commands:
```bash
# Create tunnel
cloudflared tunnel create <NAME>

# Route DNS
cloudflared tunnel route dns <TUNNEL> <HOSTNAME>

# Get token
cloudflared tunnel token <TUNNEL>

# List tunnels
cloudflared tunnel list

# Get tunnel info
cloudflared tunnel info <TUNNEL>

# Delete tunnel
cloudflared tunnel delete <TUNNEL>
```

### Files:
```
/home/lexus/projects/telegramBots/fb_insta_voice_msg/k8s.yaml
/home/lexus/projects/telegramBots/fb_insta_voice_msg/kubernetes/cloudflared-tunnel.yaml
/home/lexus/projects/telegramBots/fb_insta_voice_msg/wrangler.toml
/home/lexus/projects/telegramBots/fb_insta_voice_msg/scripts/dns-setup.sh
```

### URLs:
```
Cloudflare Dashboard: https://dash.cloudflare.com
Tunnel Docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
DNS Docs: https://developers.cloudflare.com/dns/
```

---

## Summary

**Current Setup:** Cloudflare Tunnel (Recommended)

**Domain:** voicemsg.net

**Subdomains:**
- `bridge.voicemsg.net` → MTProto Bridge (via tunnel)
- `app.voicemsg.net` → Frontend (via worker)
- `voicemsg.net` → Cloudflare Worker

**Status:** 🟢 Configuration Complete

**Next Steps:**
1. Run `./scripts/dns-setup.sh`
2. Verify DNS propagation
3. Deploy with `./scripts/deploy.sh`
4. Test endpoints
5. Monitor for 24 hours

**Documentation:**
- INFRASTRUCTURE.md - Full infrastructure details
- DEPLOYMENT_GUIDE.md - Complete deployment guide
- AGENTS.md - Development guidelines

**Support:**
- Cloudflare: https://support.cloudflare.com
- Kubernetes: https://kubernetes.io/docs
- Issue Tracker: Project repository

---

*Last Updated: 2026-05-05*
*Domain: voicemsg.net*
*Environment: Production*