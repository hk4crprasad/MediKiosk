from dataclasses import dataclass
from functools import lru_cache
from hashlib import sha256
from pathlib import Path


@dataclass(frozen=True)
class PromptSpec:
    prompt_id: str
    version: str
    task: str
    text: str
    sha256: str

    @property
    def metadata(self) -> dict[str, str]:
        return {
            "prompt_id": self.prompt_id,
            "prompt_version": self.version,
            "prompt_sha256": self.sha256,
            "prompt_task": self.task,
        }


_PROMPT_DIRECTORY = Path(__file__).parent / "prompts"
_PROMPT_FILES = {
    "summary": ("summary.clinician_draft", "openai-compatible-summary-v1", "summary.openai-compatible-summary-v1.md"),
    "document_extraction": (
        "document_extraction.visible_text",
        "luna-vision-v1",
        "document-extraction.luna-vision-v1.md",
    ),
}


@lru_cache
def get_prompt(task: str) -> PromptSpec:
    try:
        prompt_id, version, filename = _PROMPT_FILES[task]
    except KeyError as exc:
        raise ValueError(f"Unknown prompt task: {task}") from exc
    text = (_PROMPT_DIRECTORY / filename).read_text(encoding="utf-8").strip()
    if not text:
        raise RuntimeError(f"Prompt file is empty: {filename}")
    return PromptSpec(
        prompt_id=prompt_id,
        version=version,
        task=task,
        text=text,
        sha256=sha256(text.encode("utf-8")).hexdigest(),
    )
