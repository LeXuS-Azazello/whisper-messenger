# ECHO MESSENGER - INFRASTRUCTURE DEPLOYMENT SUMMARY

## ✅ DEPLOYMENT COMPLETE

Date: 2026-05-05
Domain: voicemsg.net
Environment: Production (Kubernetes)

## 🏗️ ARCHITECTURE

```

                    Cloudflare Edge                          
  
    voicemsg.net (Cloudflare Worker)                         
    - Webhook Handler                                        
    - Telegram/Meta/WhatsApp Routing                         
    - Whisper ASR Proxy                                      
    - OAuth & Authentication                                 
  
                          │
                          ▼

                  Cloudflare Tunnel                          
  - Secure HTTPS ingress                                     
  - DNS: bridge.voicemsg.net → Kubernetes Ingress            

                          │
                          ▼

                     Kubernetes Cluster                       
  Namespace: debugging-echovoice                             

                    
                                              
                                              
         
     MTProto Bridge        Qwen3-ASR       Redis  
     Manager              (Transcription)   (Cache)
     1 Pod                1 Pod             1 Pod  
     200m/512Mi           4-12 CPU/16-32Gi  100m/512Mi
         
         
                                             
                                             
                    
                   User Pods (Dynamic)         
                   Per User Telegram Client   
                   100m/512Mi each            
                   Spawned on demand           
                    
                                              
                                              
         
      Frontend         Cloudflared           
      (React)           Tunnel               
      1 Pod             Ingress              
         

```

## 📦 KUBERNETES RESOURCES CREATED

### 1. Core Services

#### Redis (Session Management)
- **Deployment**: `redis`
- **Service**: `redis:6379` (ClusterIP)
- **Resources**: 100m CPU / 256Mi RAM
- **Purpose**: Caching, session storage, pub/sub

#### Qwen3-ASR (Voice Transcription)
- **Deployment**: `qwen3-asr`
- **Service**: `qwen3-asr:11434` (HTTP), `qwen3-asr:11435` (gRPC)
- **Storage**: 100Gi PersistentVolumeClaim
- **Resources**: 4 CPU / 16Gi RAM (requests) → 12 CPU / 32Gi RAM (limits)
- **Model**: qwen3-asr (heavy model for transcription)
- **Purpose**: AI-powered voice-to-text conversion

#### MTProto Bridge Manager
- **Deployment**: `mtproto-bridge-manager`
- **Service**: `mtproto-bridge-manager:3000` (ClusterIP)
- **Resources**: 200m CPU / 256Mi RAM (requests) → 500m CPU / 512Mi RAM (limits)
- **Purpose**: Manages user pods, handles Telegram authentication

#### User Pods (Dynamic)
- **Template**: ConfigMap `user-pod-template`
- **Resources**: 100m CPU / 128Mi RAM (requests) → 500m CPU / 512Mi RAM (limits)
- **Spawning**: Per-user, on-demand via `/spawn` API
- **Isolation**: Each user gets dedicated pod

### 2. Network Infrastructure

#### Ingress
- **Resource**: `mtproto-bridge-ingress`
- **Host**: `bridge.voicemsg.net`
- **Type**: NGINX Ingress
- **Features**: SSL redirect, rate limiting, 10MB body size

#### Network Policy
- **Resource**: `mtproto-bridge-network-policy`
- **Rules**: 
  - User pods can only communicate with bridge manager
  - Egress to Redis (6379), Qwen3-ASR (11434)
  - Internet egress (HTTPS/HTTP) via namespace

#### Cloudflare Tunnel
- **Deployment**: `cloudflared-tunnel`
- **Image**: `cloudflare/cloudflared:2024.10.0`
- **Purpose**: Secure ingress without exposing K8s API

### 3. RBAC

#### Service Account
- **Name**: `mtproto-bridge-sa`
- **Permissions**: Pod management, PVC access

#### Role & RoleBinding
- **Role**: `pod-manager-role`
- **Permissions**: create/delete/list pods, services, PVCs

## 🔧 CONFIGURATION FILES

### Primary Files
1. **k8s.yaml** - Main Kubernetes configuration (170 lines)
2. **whisper-messenger-env-secret.yaml** - Environment secrets
3. **cloudflared-tunnel.yaml** - Cloudflare tunnel resources
4. **mtproto-bridge/k8s.yaml** - Bridge-specific resources

### Updated Files
1. **wrangler.toml** - Cloudflare Worker configuration
2. **package.json** - Dependencies and scripts
3. **INFRASTRUCTURE.md** - This document

### Scripts
1. **scripts/deploy.sh** - Full deployment automation
2. **scripts/setup-cloudflare.sh** - Cloudflare tunnel setup

## 🚀 DEPLOYMENT COMMANDS

### Quick Deploy
```bash
# Full infrastructure deployment
./scripts/deploy.sh
```

### Manual Deploy
```bash
# 1. Configure Kubernetes
kube-dc login --domain kube-dc.cloud --org debugging
kube-dc use kube-dc.cloud/debugging/echovoice

# 2. Apply Kubernetes resources
kubectl apply -f k8s.yaml
kubectl apply -f kubernetes/whisper-messenger-env-secret.yaml
kubectl apply -f kubernetes/cloudflared-tunnel.yaml

# 3. Deploy Cloudflare Worker
npm run deploy:worker

# 4. Deploy Bridge
npm run deploy:server
npm run deploy:k8s
```

### Verify Deployment
```bash
# Check pods
kubectl get pods -n debugging-echovoice

# Check services
kubectl get svc -n debugging-echovoice

# Test endpoints
curl https://voicemsg.net/health
curl http://localhost:3000/health
```

## ⚡ RESOURCE ALLOCATION SUMMARY

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit | Storage |
|-----------|-------------|-----------|----------------|--------------|----------|
| Qwen3-ASR | 4 CPU | 12 CPU | 16 GiB | 32 GiB | 100 Gi |
| Redis | 100m | 500m | 256 MiB | 512 MiB | 512 MiB |
| Bridge Manager | 200m | 500m | 256 MiB | 512 MiB | - |
| User Pod (each) | 100m | 500m | 128 MiB | 512 MiB | - |
| Frontend | 100m | 500m | 128 MiB | 512 MiB | - |

**Total Node Resources:**
- CPU: 12 cores available
- Memory: 42 GiB available
- Storage: 320 GiB available
- Max Pods: 500

## 🌐 DNS CONFIGURATION

### Cloudflare Records

| Type | Name | Target | Proxy | Purpose |
|------|------|--------|-------|---------|
| A | voicemsg.net | Worker IP | ✓ | Frontend + API |
| A | bridge.voicemsg.net | Tunnel IP | ✓ | MTProto Bridge |
| A | app.voicemsg.net | Tunnel IP | ✓ | Web UI |

### Internal DNS (Kubernetes)
- `redis.debugging-echovoice.svc.cluster.local`
- `qwen3-asr.debugging-echovoice.svc.cluster.local`
- `mtproto-bridge-manager.debugging-echovoice.svc.cluster.local`
- `echo-frontend.debugging-echovoice.svc.cluster.local`

## 🔒 SECURITY FEATURES

1. **Network Isolation**
   - Network policies restrict pod-to-pod communication
   - User pods isolated from each other
   - Internal services not exposed externally

2. **Secret Management**
   - All credentials in Kubernetes Secrets
   - Environment-specific configuration
   - Cloudflare tunnel for secure ingress

3. **RBAC**
   - Limited service account permissions
   - Role-based access control
   - No cluster-wide privileges

4. **Monitoring**
   - Health checks on all services
   - Liveness and readiness probes
   - Cloudflare observability

## 📊 SCALING STRATEGY

### Horizontal Pod Autoscaling (Future)
```yaml
# Bridge Manager
- Scale based on API requests (target: 100 req/s per pod)

# User Pods
- Scale per user (1 pod per user)
- Auto-cleanup after inactivity (24h)
```

### Vertical Scaling (Current)
- Qwen3-ASR: Can allocate up to 12 CPU / 32 GiB
- Bridge Manager: Can scale to 2+ pods
- Redis: Add replica for HA if needed

## 🔧 TROUBLESHOOTING

### Common Issues

1. **Pods not starting**
   ```bash
   kubectl describe pod <name> -n debugging-echovoice
   kubectl logs <name> -n debugging-echovoice
   ```

2. **Redis connection errors**
   ```bash
   kubectl exec -it redis-xxx -n debugging-echovoice -- redis-cli ping
   ```

3. **Qwen3-ASR not loading model**
   ```bash
   kubectl logs -f qwen3-asr-xxx -n debugging-echovoice
   # Check PVC mount
   kubectl describe pvc qwen3-asr-pvc -n debugging-echovoice
   ```

4. **DNS resolution issues**
   ```bash
   # Test from pod
   kubectl run -it --rm debug --image=busybox -n debugging-echovoice -- nslookup redis
   ```

## 📈 MONITORING & LOGS

```bash
# Real-time logs
kubectl logs -f -l app=echo-messenger -n debugging-echovoice

# Resource usage
kubectl top pods -n debugging-echovoice

# Event stream
kubectl get events -n debugging-echovoice --watch
```

## 🔄 UPDATE & MAINTENANCE

### Update Bridge
```bash
# Build new image
docker build -t azazellosaraksh/debugging-mtproto-bridge:v3 .
docker push azazellosaraksh/debugging-mtproto-bridge:v3

# Update deployment
kubectl set image deployment/mtproto-bridge-manager bridge=azazellosaraksh/debugging-mtproto-bridge:v3 -n debugging-echovoice
```

### Update Worker
```bash
npm run deploy:worker
```

### Update Config
```bash
# Edit k8s.yaml
vim k8s.yaml

# Apply changes
kubectl apply -f k8s.yaml
```

## ✅ VERIFICATION CHECKLIST

- [x] Kubernetes cluster configured (kube-dc)
- [x] Namespace created (debugging-echovoice)
- [x] Redis deployment running
- [x] Qwen3-ASR deployment running
- [x] Bridge Manager deployment running
- [x] Secrets configured (whisper-messenger-env)
- [x] Network policies applied
- [x] Ingress configured (bridge.voicemsg.net)
- [x] Cloudflare tunnel deployed
- [x] DNS records configured
- [x] Cloudflare Worker deployed
- [x] RBAC permissions configured
- [x] Health checks passing
- [x] Service endpoints accessible

## 📞 SUPPORT

**Domain:** voicemsg.net  
**Environment:** Production (Kubernetes)  
**Namespace:** debugging-echovoice  
**Created:** 2026-05-05

## 🎯 KEY FEATURES IMPLEMENTED

1. ✅ Multi-tenant architecture (1 user = 1 pod)
2. ✅ Heavy AI model isolation (Qwen3-ASR separate pod)
3. ✅ Secure network policies
4. ✅ Cloudflare tunnel for ingress
5. ✅ Redis for session management
6. ✅ Dynamic pod spawning
7. ✅ Resource limits and requests
8. ✅ Health monitoring
9. ✅ Scalable to 500 pods
10. ✅ Production-ready configuration

## 🚨 CONFIGURATION NOTES

### DNS Configuration Options

#### **Option 1: Cloudflare Tunnel (RECOMMENDED)**

Use Cloudflare Tunnel for secure ingress without exposing Kubernetes API:

1. **Run setup script:**
   ```bash
   ./scripts/dns-setup.sh
   ```

2. **Manual DNS Records:**
   ```
   Type    Name                    Target                              Proxy
   ────────────────────────────────────────────────────────────────────────
   CNAME   bridge.voicemsg.net     <TUNNEL_ID>.cfargotunnel.com       ✅ Proxied
   CNAME   app.voicemsg.net        <TUNNEL_ID>.cfargotunnel.com       ✅ Proxied
   A       voicemsg.net            <WORKER_IP>                        ✅ Proxied
   ```

3. **Update Kubernetes secret:**
   ```bash
   kubectl create secret generic cloudflared-tunnel-token \
     --namespace=debugging-echovoice \
     --from-literal=token="$(cloudflared tunnel token <TUNNEL_ID>)" \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

#### **Option 2: Direct CNAME (Alternative)**

Point CNAME directly to Kubernetes Ingress IP:

```
Type    Name                    Target              Proxy
──────────────────────────────────────────────────────────
CNAME   bridge.voicemsg.net     <INGRESS_IP>        ❌ DNS Only
A       voicemsg.net            <WORKER_IP>         ✅ Proxied
```

⚠️ **WARNING:** Requires exposing ingress IP publicly

#### **Option 3: Load Balancer (Enterprise)**

Use Cloudflare Load Balancer for advanced routing:

1. Create Load Balancer in Cloudflare
2. Configure pool with Kubernetes nodes
3. Health checks on `/health` endpoint
4. Automatic failover

---

### Domain Configuration

- **Root Domain:** voicemsg.net (Cloudflare Worker)
- **Bridge Subdomain:** bridge.voicemsg.net (Kubernetes Ingress via Tunnel)
- **App Subdomain:** app.voicemsg.net (Cloudflare Worker)
- **Internal DNS:** All K8s services use internal DNS (cluster.local)
- **Never use localhost** - All testing on remote Kubernetes

### Security Requirements

- **Secrets:** Update all default passwords before production
  - `SESSION_SECRET` - Change immediately
  - `ADMIN_SECRET` - Set unique value
  - `BRIDGE_SECRET` - Generate secure key
  - Telegram/Google API keys - Use production credentials

- **Network Policy:**
  - User pods isolated from each other
  - Internal services not exposed
  - Cloudflare tunnel required for external access

### Resource Monitoring

- **Qwen3-ASR Memory:** Monitor 32GiB limit
  ```bash
  kubectl top pod -l app=qwen3-asr -n debugging-echovoice
  ```
  
- **Pod Count:** Track user pods vs 500 limit
  ```bash
  kubectl get pods -n debugging-echovoice --no-headers | wc -l
  ```

- **Storage:** Check PVC usage
  ```bash
  kubectl describe pvc qwen3-asr-pvc -n debugging-echovoice
  ```

### Backup Requirements

- **Secrets:** Export before any changes
  ```bash
  kubectl get secret whisper-messenger-env -n debugging-echovoice -o yaml > backup-secret.yaml
  ```
  
- **PVCs:** Regular snapshot of Qwen3-ASR data
- **Config:** Version control all YAML files
- **Worker:** Tag Cloudflare Worker versions

## 📚 REFERENCE

- **Kubernetes Docs:** https://kubernetes.io/docs/
- **Cloudflare Workers:** https://developers.cloudflare.com/workers/
- **MTProto Bridge:** mtproto-bridge/
- **Whisper ASR:** Qwen3-ASR (Ollama)

---

**Infrastructure as Code:** All configurations version controlled  
**Deployment:** Automated via scripts/deploy.sh  
**Monitoring:** Cloudflare + Kubernetes metrics  
**Backup:** Secrets and PVCs should be backed up regularly
