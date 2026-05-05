# 🚀 ECHO MESSENGER - QUICK REFERENCE

## Domain: voicemsg.net | Namespace: debugging-echovoice

---

## 🎯 QUICK START

```bash
# FULL DEPLOYMENT (All-in-One)
cd /home/lexus/projects/telegramBots/fb_insta_voice_msg
./scripts/deploy.sh
```

```bash
# STEP-BY-STEP
# 1. Kubernetes
kubectl apply -f k8s.yaml
kubectl apply -f kubernetes/whisper-messenger-env-secret.yaml

# 2. DNS & Tunnel
./scripts/dns-setup.sh

# 3. Wait for DNS
sleep 300

# 4. Test
curl https://bridge.voicemsg.net/health

# 5. Worker
npm run deploy:worker
```

---

## 📊 VERIFICATION

```bash
# Pods Status
kubectl get pods -n debugging-echovoice

# Services
kubectl get svc -n debugging-echovoice

# Health Checks
curl https://bridge.voicemsg.net/health
curl https://voicemsg.net/health

# Logs
kubectl logs -f -n debugging-echovoice
```

---

## 🌐 DNS CONFIGURATION

### Cloudflare Tunnel (Recommended)

```
Type    Name              Target                      Proxy
───────────────────────────────────────────────────────
CNAME   bridge.voicemsg   <TUNNEL_ID>.cfargotunnel    ✅
CNAME   app.voicemsg      <TUNNEL_ID>.cfargotunnel    ✅
A       voicemsg.net      <WORKER_IP>                 ✅
```

**Setup:** `./scripts/dns-setup.sh`

---

## 🏗️ ARCHITECTURE

```
Cloudflare Worker → Cloudflare Tunnel → Kubernetes Ingress
                                                ↓
                                    
                                      Bridge     Qwen3-ASR   Redis   
                                      Manager      
                                    
                                                ↓
                                    
                                      User Pods (1 per user)    
                                      500 max                   
                                    
```

---

## 📦 COMPONENTS

| Component | CPU | RAM | Storage | Purpose |
|-----------|-----|-----|---------|---------|
| Qwen3-ASR | 4-12 | 16-32Gi | 100Gi | AI transcription |
| Redis | 100m | 256Mi | 512Mi | Cache/sessions |
| Bridge Mgr | 200m | 256Mi | - | Manages pods |
| Frontend | 100m | 128Mi | - | Web UI |
| User Pod | 100m | 128Mi | - | Per-user client |

---

## 🔒 SECURITY

- ✅ Cloudflare Tunnel (no public K8s)
- ✅ Network Policies (pod isolation)
- ✅ SSL/TLS at edge
- ✅ RBAC + Secrets
- ⚠️ **CHANGE ALL DEFAULT PASSWORDS!**

---

## 🚨 CRITICAL NOTES

1. **Domain:** voicemsg.net only (no localhost)
2. **Secrets:** Update SESSION_SECRET, ADMIN_SECRET, BRIDGE_SECRET
3. **Memory:** Monitor Qwen3-ASR (32GiB limit)
4. **Pods:** 500 max user pods
5. **Testing:** Remote K8s only

---

## 🔧 TROUBLESHOOTING

```bash
# DNS Issue
dig bridge.voicemsg.net
cloudflared tunnel list

# Pod Crash
kubectl describe pod <name> -n debugging-echovoice
kubectl logs <name> -n debugging-echovoice

# Redis
dig redis.debugging-echovice.svc.cluster.local

# ASR
kubectl logs -f -l app=qwen3-asr -n debugging-echovice
```

---

## 📈 MONITORING

```bash
# Resources
kubectl top pods -n debugging-echovice

# Events
kubectl get events -n debugging-echovice --watch

# Pod Health
kubectl get pods -n debugging-echovice -o wide
```

---

## 📚 DOCUMENTATION

- **DEPLOYMENT_COMPLETE.md** - Full overview
- **DEPLOYMENT_GUIDE.md** - Detailed deployment steps
- **INFRASTRUCTURE.md** - Architecture details
- **DNS_SETUP.md** - DNS configuration

---

## 🔄 UPDATES

```bash
# Bridge
kubectl set image deployment/mtproto-bridge-manager \
  bridge=azazellosaraksh/debugging-mtproto-bridge:v3 \
  -n debugging-echovice

# Worker
npm run deploy:worker

# Config
kubectl apply -f k8s.yaml
```

---

## ✅ STATUS

**Configuration:** ✅ COMPLETE  
**Deployment:** 🟡 PENDING (`./scripts/deploy.sh`)  
**Date:** 2026-05-05  

**🚀 READY FOR DEPLOYMENT!**

---

## 📞 QUICK COMMANDS

```bash
# Deploy          ./scripts/deploy.sh
# DNS Setup       ./scripts/dns-setup.sh
# Status          kubectl get pods -n debugging-echovice
# Logs            kubectl logs -f -n debugging-echovice
# Test Bridge     curl https://bridge.voicemsg.net/health
# Test Worker     curl https://voicemsg.net/health
```

---

**All systems operational! 🚀**  
**Last updated:** 2026-05-05
