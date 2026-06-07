# Voice Messenger TODO List

## Samesame (CosyVoice)
- [ ] **Replace Text Normalizer**:
  - Remove the Chinese `wetext` normalizer (`ZhNormalizer`).
  - Replace it with a Russian normalizer such as `RUNorm-normalizer-small` (https://huggingface.co/RUNorm/RUNorm-normalizer-small/tree/main) or `runorm` (https://github.com/Den4ikAI/runorm).
  - Ensure the new normalizer is properly added to `samesame-downloader-job.sh` and no network requests are made during startup (offline mode).
