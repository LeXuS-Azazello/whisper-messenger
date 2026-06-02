import os
import sys

# Читаем переменные окружения, переданные из Kubernetes Job
MODELS_DIR = os.getenv("MODELS_DIR", "/models")
MODELS_TO_DOWNLOAD = {
    "model": os.getenv("FUNASR_MODEL_NAME", "FunAudioLLM/Fun-ASR-MLT-Nano-2512"),
    "vad": os.getenv("FUNASR_VAD_MODEL", "iic/speech_fsmn_vad_zh-cn-16k-common-pytorch"),
    "punc": os.getenv("FUNASR_PUNC_MODEL", "iic/punc_ct-transformer_cn-en-common-vocab471067-large")
}

def download_repo(repo_id: str, target_dir: str):
    """Скачивает репозиторий с фолбеком и сохраняет строго в нужную папку."""
    print(f"Попытка скачивания {repo_id} в {target_dir}...")
    
    # Пытаемся через ModelScope
    try:
        from modelscope import snapshot_download as ms_download
        # Для ModelScope cache_dir создает структуру cache_dir/repo_id
        # Чтобы пути совпали, передаем базовую директорию верхнего уровня
        base_dir = os.path.dirname(target_dir)
        ms_download(repo_id, cache_dir=base_dir)
        print(f" Успешно скачано через ModelScope: {repo_id}")
        return
    except Exception as e:
        print(f"[-] ModelScope failed для {repo_id}: {e}. Пробуем HuggingFace...")

    # Фолбек на HuggingFace Hub
    try:
        from huggingface_hub import snapshot_download as hf_download
        # Для HF local_dir пишет файлы прямо внутрь указанной папки
        hf_download(repo_id=repo_id, local_dir=target_dir, local_dir_use_symlinks=False)
        print(f" Успешно скачано через HuggingFace: {repo_id}")
    except Exception as e:
        print(f"[CRITICAL] Не удалось скачать {repo_id}: {e}")
        sys.exit(1)

def main():
    for mode, repo in MODELS_TO_DOWNLOAD.items():
        if not repo:
            print(f"Пропуск {mode}: переменная окружения не задана.")
            continue
            
        # Формируем финальный путь, который ожидает основной Деплоймент
        # Например: /models/FunAudioLLM/Fun-ASR-MLT-Nano-2512
        target_path = os.path.join(MODELS_DIR, repo)
        
        # Проверяем, возможно модель уже скачана (для перезапусков Job)
        if os.path.isdir(target_path) and any(os.listdir(target_path)):
            print(f"Модель {repo} уже существует в {target_path}. Пропуск.")
            continue
            
        download_repo(repo, target_path)

if __name__ == "__main__":
    main()
