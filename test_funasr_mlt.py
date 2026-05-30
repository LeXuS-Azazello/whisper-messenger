import os
from funasr import AutoModel

print("Loading Fun-ASR-MLT-Nano...")
model = AutoModel(model="iic/SenseVoiceSmall", device="cpu") # SenseVoice only 5 langs
# Let's try FunAudioLLM/Fun-ASR-MLT-Nano-2512? Wait, let's just see if we can use it!
try:
    model2 = AutoModel(model="FunAudioLLM/Fun-ASR-MLT-Nano-2512", device="cpu")
    print("Fun-ASR-MLT-Nano-2512 loaded successfully!")
except Exception as e:
    print(f"Error: {e}")
