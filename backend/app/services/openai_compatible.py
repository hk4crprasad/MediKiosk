import json
import logging

from openai import APIError, APITimeoutError, AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError

from app.core.config import Settings
from app.prompting.registry import get_prompt

logger = logging.getLogger(__name__)
PROMPT_VERSION = get_prompt("summary").version


class GeneratedSummary(BaseModel):
    summary_text: str = Field(min_length=1, max_length=12000)


class OpenAICompatibleSummaryGenerator:
    """Official OpenAI SDK client for a base-URL-compatible Chat Completions provider."""

    def __init__(self, settings: Settings):
        self._base_url = settings.llm_base_url
        self._api_key = settings.llm_api_key
        self._model = settings.llm_model
        self._timeout = settings.llm_timeout_seconds

    @property
    def configured(self) -> bool:
        return bool(self._base_url and self._api_key)

    async def generate(self, structured_facts: dict) -> GeneratedSummary:
        if not self.configured:
            raise RuntimeError("OpenAI-compatible generation is not configured")
        system_prompt = get_prompt("summary").text
        client = AsyncOpenAI(api_key=self._api_key, base_url=self._base_url, timeout=self._timeout)
        try:
            response = await client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": "Structured clinical facts:\n" + json.dumps(structured_facts, ensure_ascii=False),
                    },
                ],
            )
            content = response.choices[0].message.content
            if not isinstance(content, str):
                raise ValueError("Provider response content is not text")
            return GeneratedSummary.model_validate_json(content)
        except (APIError, APITimeoutError, IndexError, TypeError, ValueError, ValidationError) as exc:
            logger.warning("OpenAI-compatible summary generation failed; template fallback will be used: %s", exc)
            raise RuntimeError("OpenAI-compatible provider output was unavailable or invalid") from exc
        finally:
            await client.close()
