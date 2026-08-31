"""Shared upload validation for both encounter-scoped documents and patient-portal
records: allowed MIME types, filename sanitisation, and magic-byte signature checks."""

import re
from pathlib import Path

ALLOWED_MIME_TYPES = {"application/pdf", "image/jpeg", "image/png"}

_SIGNATURES = {
    "application/pdf": b"%PDF-",
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
}


def safe_filename(filename: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name)[:200] or "upload"


def has_expected_file_signature(content: bytes, mime_type: str) -> bool:
    return content.startswith(_SIGNATURES[mime_type])
