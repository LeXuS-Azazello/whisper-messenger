import json
import urllib.request

url = "https://www.modelscope.cn/api/v1/models?Name=asr&Task=auto-speech-recognition"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    
models = data.get("Data", {}).get("Models", [])
for m in models:
    name = m.get("Name", "").lower()
    if "ru" in name or "multilingual" in name or "mlt" in name or "nano" in name:
        print(m.get("Path"))
