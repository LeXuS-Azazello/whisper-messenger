import os
import sys

# Полностью отключаем GPU для легковесного скачивания
os.environ["CUDA_VISIBLE_DEVICES"] = ""

# Базовая папка (Kubernetes смонтирует сюда PVC)
MODELS_DIR = sys.argv[1] if len(sys.argv) > 1 else "/models"
MODEL_NAME = os.environ.get(
    "SAMESAME_MODEL_NAME", "FunAudioLLM/Fun-CosyVoice3-0.5B-2512"
)

TARGET_DIR = os.path.join(MODELS_DIR, MODEL_NAME)

print(f"[samesame-downloader] MODELS_DIR={MODELS_DIR}")
print(f"[samesame-downloader] Downloading model {MODEL_NAME} to {TARGET_DIR}...")

try:
    from modelscope import snapshot_download

    # local_dir гарантирует, что модель скачается чистыми файлами, а не кэшем
    snapshot_download(MODEL_NAME, local_dir=TARGET_DIR)
    print("[samesame-downloader] Download complete successfully.")
except Exception as e:
    print(f"[samesame-downloader] Error downloading model via modelscope: {e}")
    sys.exit(1)
