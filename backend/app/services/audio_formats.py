"""Strict audio upload format handling for browser and fixture recordings."""

from types import MappingProxyType

AUDIO_EXTENSION_BY_MIME = MappingProxyType(
    {
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mp4": "m4a",
        "audio/x-m4a": "m4a",
        "audio/m4a": "m4a",
    }
)
SUPPORTED_AUDIO_MIME_TYPES = frozenset(AUDIO_EXTENSION_BY_MIME)


def normalise_audio_mime_type(mime_type: str | None) -> str:
    """Return the lower-case base media type without codec parameters."""
    return (mime_type or "").split(";", 1)[0].strip().lower()


def audio_extension(mime_type: str) -> str:
    return AUDIO_EXTENSION_BY_MIME[normalise_audio_mime_type(mime_type)]


def has_expected_audio_signature(content: bytes, mime_type: str) -> bool:
    """Validate common container signatures without decoding untrusted audio."""
    normalised = normalise_audio_mime_type(mime_type)
    if normalised in {"audio/wav", "audio/x-wav"}:
        return len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WAVE"
    if normalised in {"audio/mpeg", "audio/mp3"}:
        return content.startswith(b"ID3") or (
            len(content) >= 2 and content[0] == 0xFF and content[1] & 0xE0 == 0xE0
        )
    if normalised == "audio/webm":
        return content.startswith(b"\x1a\x45\xdf\xa3")
    if normalised == "audio/ogg":
        return content.startswith(b"OggS")
    if normalised in {"audio/mp4", "audio/x-m4a", "audio/m4a"}:
        return len(content) >= 12 and content[4:8] == b"ftyp"
    return False
