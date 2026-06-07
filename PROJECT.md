# Voice Messenger - Project State (Updated: 2026-06-04)

## Current Status

### Running Services ✅

| Service | Status | Port | Notes |
|---------|--------|------|-------|
| echo-frontend | Running | 80 | Web UI - ✅ |
| funasr | Running | 50001 | ASR - ✅ Works (90s per request) |
| samesame | Running | 8002 | TTS CosyVoice3 - ❌ ONNX tokenizer dimension error |
| tg-client-manager | Running | 3000 | Telegram manager - ✅ |
| whatsapp-baileys-manager | Running | 3002 | WhatsApp manager - ✅ |
| mongodb | Running | 27017 | Database - ✅ |
| redis | Running | 6379 | Cache/Queue - ✅ |

### ConfigMap (no duplicates) ✅
- funasr-download-scripts, funasr-server
- samesame-app-py, samesame-download-scripts  
- tg-client-pod-template, tg-client-samesame-patch
- voicemsg-tester-patch
- wa-baileys-pod-template

### PVC ✅
- funasr-model-pvc (20Gi) - ASR models downloaded
- samesame-model-cache (20Gi) - CosyVoice3 downloaded

### Samesame Issue
- inference_zero_shot падает с ONNX ошибкой: `Invalid rank for input: feats Got: 4 Expected: 3`
- Исправлен патч в `samesame/cosyvoice-cli-frontend.py` (n_mels 128 → 80)
- **Образ теперь собирается и деплоится автоматически через Forgejo CI/CD!**