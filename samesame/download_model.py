import os
import sys

# Disable GPU
os.environ["CUDA_VISIBLE_DEVICES"] = "0"

MODELS_DIR = sys.argv[1] if len(sys.argv) > 1 else "/models"
MODEL_NAME = os.environ.get(
    "SAMESAME_MODEL_NAME", "FunAudioLLM/Fun-CosyVoice3-0.5B-2512"
)

print(f"Downloading model {MODEL_NAME} to {MODELS_DIR}...")
try:
    from modelscope import snapshot_download

    snapshot_download(MODEL_NAME, cache_dir=MODELS_DIR, hub="ms")
    print("Download complete.")
except Exception as e:
    print(f"Error downloading model via modelscope: {e}")
    sys.exit(1)
