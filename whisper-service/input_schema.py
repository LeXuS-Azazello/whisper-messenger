"""
whisper-service /v1/transcribe-path — input schema document.

Accepted MIME types
────────────────────
Audio : audio/ogg | audio/opus | audio/wav | audio/flac | audio/mpeg |
        audio/mp4 | audio/aac | audio/webm | audio/x-m4a | audio/mp3

Video : video/mp4 | video/webm | video/quicktime | video/x-msvideo |
        video/x-matroska

Video input is converted to WAV on-the-fly via ffmpeg before transcription.
"""

# ── MIME allow-lists ──────────────────────────────────────────────────────────

SUPPORTED_AUDIO: set[str] = {
    "audio/ogg",
    "audio/opus",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/flac",
    "audio/mpeg",   # mp3
    "audio/mp3",
    "audio/mp4",    # aac-in-mp4
    "audio/aac",
    "audio/webm",
    "audio/x-m4a",
}

SUPPORTED_VIDEO: set[str] = {
    "video/mp4",
    "video/webm",
    "video/quicktime",    # .mov
    "video/x-msvideo",    # .avi
    "video/x-matroska",   # .mkv
}

SUPPORTED_MIMES: set[str] = SUPPORTED_AUDIO | SUPPORTED_VIDEO


# ── Flat spec — merged view of all accepted fields ─────────────────────────────
# Keys mirror the JSON body of POST /v1/transcribe-path.
# This dict is consumed by documentation generators and integration tests.

INPUT_SCHEMA: dict[str, dict] = {
    # ── core (always required) ──────────────────────────────────────────────────
    "file_path": {
        "datatype": "STRING",
        "required": True,
        "shape": [1],
        "example": ["/shared/tg-files/987654321.ogg"],
        "description": (
            "Absolute path to the media file on the shared emptyDir volume "
            "(/shared/tg-files)."
        ),
    },
    "mime_type": {
        "datatype": "STRING",
        "required": True,
        "shape": [1],
        "example": ["audio/ogg"],
        "description": (
            "IANA media type of the *original* file as received from the caller "
            "(before any ffmpeg conversion)."
        ),
    },
    "language": {
        "datatype": "STRING",
        "required": False,
        "shape": [1],
        "example": ["ru"],
        "description": "ISO 639-1 language code. Omit or pass null for auto-detect.",
    },
    # ── routing metadata ────────────────────────────────────────────────────────
    "source": {
        "datatype": "STRING",
        "required": False,
        "shape": [1],
        "example": ["telegram"],
        "description": "Caller platform: telegram | whatsapp | messenger | web.",
    },
    "reply_to": {
        "datatype": "STRING",
        "required": False,
        "shape": [1],
        "example": ["req_abc123"],
        "description": "Arbitrary callback / request ID for async reply routing.",
    },
    # ── Telegram extras ─────────────────────────────────────────────────────────
    "chat_id": {
        "datatype": "INT64",
        "required": False,
        "shape": [1],
        "example": [123456789],
        "description": "Telegram chat_id. Positive = private, negative = group/supergroup.",
    },
    "message_id": {
        "datatype": "INT64",
        "required": False,
        "shape": [1],
        "example": [42],
        "description": "Telegram message_id — used to reply in-thread.",
    },
    "is_private": {
        "datatype": "BOOL",
        "required": False,
        "shape": [1],
        "example": [True],
        "description": "True for private / secret chats; False for groups.",
    },
    "file_unique_id": {
        "datatype": "STRING",
        "required": False,
        "shape": [1],
        "example": ["AgADAgADf60xG9nMIAb65ft6kpKF"],
        "description": "Telegram file_unique_id — stable across re-uploads.",
    },
    # ── WhatsApp extras ─────────────────────────────────────────────────────────
    "phone_number_id": {
        "datatype": "STRING",
        "required": False,
        "shape": [1],
        "example": ["123456789012345"],
        "description": "WhatsApp Business phone_number_id for reply-context.",
    },
    "from_number": {
        "datatype": "STRING",
        "required": False,
        "shape": [1],
        "example": ["79001234567"],
        "description": "Sender phone number in E.164 format (without leading +).",
    },
    "user_id": {
        "datatype": "STRING",
        "required": False,
        "shape": [1],
        "example": ["user_42"],
        "description": "Internal user identifier for logging / rate-limits.",
    },
}
