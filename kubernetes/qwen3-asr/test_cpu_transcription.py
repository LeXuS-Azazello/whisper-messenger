import os
import sys
import time
import torch
from qwen_asr.inference import Qwen3ASR


def test_cpu_transcription():
    """Test Qwen3-ASR transcription on CPU"""
    print("=" * 50)
    print("Qwen3-ASR CPU Transcription Test")
    print("=" * 50)

    # Check device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    if device == "cuda":
        print("WARNING: CUDA is available but we want CPU test")
        print("Setting device to CPU manually")
        device = "cpu"

    # Model name
    model_name = os.getenv("MODEL_NAME", "Qwen/Qwen3-ASR-0.6B")
    print(f"Loading model: {model_name}")

    try:
        # Load model on CPU
        start_load = time.time()
        model = Qwen3ASR(model_name, device=device)
        load_time = time.time() - start_load
        print(f"Model loaded in {load_time:.2f}s on {device}")

        # Check memory usage (approximate)
        if torch.cuda.is_available():
            print(
                f"GPU memory allocated: {torch.cuda.memory_allocated() / 1024**2:.2f} MB"
            )
        else:
            print("Running on CPU - check system memory via kubectl top")

        # Create a dummy audio file for testing
        import numpy as np
        import soundfile as sf

        # Generate 3 seconds of silence at 16kHz
        samplerate = 16000
        duration = 3
        data = np.zeros(samplerate * duration, dtype=np.float32)
        test_file = "test_audio.wav"
        sf.write(test_file, data, samplerate)
        print(f"Created test audio file: {test_file}")

        # Transcribe
        print("Starting transcription...")
        start_transcribe = time.time()
        result = model.transcribe(test_file)
        transcribe_time = time.time() - start_transcribe

        print(f"Transcription completed in {transcribe_time:.2f}s")
        print(f"Result: {result}")

        # Cleanup
        if os.path.exists(test_file):
            os.remove(test_file)

        print("=" * 50)
        print("TEST PASSED: CPU transcription works!")
        print("=" * 50)
        return True

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_cpu_transcription()
    sys.exit(0 if success else 1)
