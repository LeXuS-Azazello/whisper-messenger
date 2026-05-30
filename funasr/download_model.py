import os
import sys

model_name = os.getenv("MODEL_NAME", "FunAudioLLM/Fun-ASR-MLT-Nano-2512")
local_dir = sys.argv[1] if len(sys.argv) > 1 else "/models"

print(f"Downloading {model_name} to {local_dir}...")
try:
    from modelscope import snapshot_download
    snapshot_download(model_name, cache_dir=local_dir)
except Exception as e:
    print(f"ModelScope download failed, falling back to huggingface_hub: {e}")
    from huggingface_hub import snapshot_download as hf_snapshot_download
    hf_snapshot_download(repo_id=model_name, local_dir=local_dir)
print("Download complete!")