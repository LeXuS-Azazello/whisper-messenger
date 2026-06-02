import os
import sys

# Полностью отключаем GPU для легковесного скачивания
os.environ["CUDA_VISIBLE_DEVICES"] = ""

# Базовая папка (Kubernetes смонтирует сюда PVC)
MODELS_DIR = sys.argv[1] if len(sys.argv) > 1 else "/models"
MODELS_TO_DOWNLOAD = [
    "FunAudioLLM/Fun-CosyVoice3-0.5B-2512",
    "FunAudioLLM/CosyVoice-ttsfrd"
]

for model_name in MODELS_TO_DOWNLOAD:
    target_dir = os.path.join(MODELS_DIR, "pretrained_models", model_name.split('/')[-1])
    print(f"[samesame-downloader] Downloading {model_name} to {target_dir}...")
    try:
        from modelscope import snapshot_download
        snapshot_download(model_name, local_dir=target_dir)
        print(f"[samesame-downloader] {model_name} complete.")
    except Exception as e:
        print(f"[samesame-downloader] Error downloading {model_name}: {e}")
        sys.exit(1)
