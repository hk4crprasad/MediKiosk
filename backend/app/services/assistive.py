import base64
from dataclasses import dataclass

from openai import APIConnectionError, APIError, APITimeoutError, AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError

from app.core.config import Settings
from app.core.errors import DomainError
from app.prompting.registry import get_prompt


@dataclass(frozen=True)
class AdapterOutput:
    raw_text: str
    structured_data: dict
    confidence: float | None
    language: str | None = None
    provider: str = "mock"


class ExtractedEntity(BaseModel):
    entity_type: str = Field(min_length=1, max_length=64)
    text: str = Field(min_length=1, max_length=1000)


class VisionExtraction(BaseModel):
    extracted_text: str = Field(min_length=1, max_length=20000)
    entities: list[ExtractedEntity] = Field(default_factory=list, max_length=100)


SPEECH_FIXTURES = {
    "en_chest_discomfort_v1": AdapterOutput(
        raw_text="Synthetic transcript: I have chest discomfort and breathlessness.",
        structured_data={"fixture_id": "en_chest_discomfort_v1", "requires_patient_confirmation": True},
        confidence=0.99,
        language="en",
    ),
    "en_general_v1": AdapterOutput(
        raw_text="Synthetic transcript: I would like help with my current concern.",
        structured_data={"fixture_id": "en_general_v1", "requires_patient_confirmation": True},
        confidence=0.99,
        language="en",
    ),
}

OCR_FIXTURES = {
    "printed_lab_report_v1": AdapterOutput(
        raw_text="Synthetic printed report\\nHaemoglobin: 13.2 g/dL\\nCollection date: 2026-01-01",
        structured_data={
            "fixture_id": "printed_lab_report_v1",
            "entities": [
                {"entity_type": "lab_name", "text": "Haemoglobin", "confidence": 0.99},
                {"entity_type": "lab_value", "text": "13.2 g/dL", "confidence": 0.99},
                {"entity_type": "date", "text": "2026-01-01", "confidence": 0.99},
            ],
            "requires_clinician_verification": True,
        },
        confidence=0.99,
    )
}


def require_mock_mode(mode: str, adapter_name: str) -> None:
    normalised_mode = mode.strip().lower()
    if normalised_mode == "mock":
        return
    if normalised_mode == "disabled":
        raise DomainError(
            code=f"{adapter_name}_adapter_unavailable",
            message=f"{adapter_name.upper()} adapter is disabled; use the documented manual fallback.",
            status_code=503,
        )
    raise DomainError(
        code=f"{adapter_name}_adapter_misconfigured",
        message=f"{adapter_name.upper()} adapter mode is invalid; use disabled or mock.",
        status_code=503,
    )


def mock_transcription(mode: str, fixture_id: str, language: str) -> AdapterOutput:
    require_mock_mode(mode, "speech")
    output = SPEECH_FIXTURES.get(fixture_id)
    if output is None:
        raise DomainError(code="unknown_speech_fixture", message="Unknown synthetic speech fixture", status_code=422)
    return AdapterOutput(
        raw_text=output.raw_text,
        structured_data=output.structured_data,
        confidence=output.confidence,
        language=language or output.language,
    )


def mock_document_extraction(mode: str, fixture_id: str) -> AdapterOutput:
    require_mock_mode(mode, "ocr")
    output = OCR_FIXTURES.get(fixture_id)
    if output is None:
        raise DomainError(code="unknown_ocr_fixture", message="Unknown synthetic OCR fixture", status_code=422)
    return output


class OpenAICompatibleSpeechAdapter:
    """Audio adapter using AsyncOpenAI against an OpenAI-compatible base URL."""

    def __init__(self, settings: Settings):
        self._settings = settings

    @property
    def configured_for_stt(self) -> bool:
        return bool(
            self._base_url
            and self._api_key
            and self._settings.azure_openai_stt_deployment
        )

    @property
    def configured_for_tts(self) -> bool:
        return bool(
            self._base_url
            and self._api_key
            and self._settings.azure_openai_tts_deployment
        )

    @property
    def _base_url(self) -> str | None:
        return self._settings.llm_base_url

    @property
    def _api_key(self) -> str | None:
        return self._settings.llm_api_key

    def _client(self) -> AsyncOpenAI:
        return AsyncOpenAI(
            base_url=self._base_url,
            api_key=self._api_key,
            timeout=self._settings.llm_timeout_seconds,
        )

    async def transcribe(self, content: bytes, filename: str, mime_type: str, language: str) -> AdapterOutput:
        if not self.configured_for_stt:
            raise DomainError(
                code="speech_adapter_unavailable",
                message="OpenAI-compatible speech transcription is not configured; use touch input.",
                status_code=503,
            )
        client = self._client()
        try:
            response = await client.audio.transcriptions.create(
                model=self._settings.azure_openai_stt_deployment,
                file=(filename, content, mime_type),
                language=language,
            )
            transcript = getattr(response, "text", None)
            if not isinstance(transcript, str) or not transcript.strip():
                raise ValueError("OpenAI-compatible provider returned an empty transcript")
            return AdapterOutput(
                raw_text=transcript.strip(),
                structured_data={"requires_patient_confirmation": True},
                confidence=None,
                language=language,
                provider="openai_compatible",
            )
        except (APIError, APIConnectionError, APITimeoutError, ValueError) as exc:
            raise DomainError(
                code="speech_adapter_unavailable",
                message="OpenAI-compatible speech transcription is unavailable; use touch input.",
                status_code=503,
            ) from exc
        finally:
            await client.close()

    async def synthesize(self, text: str) -> bytes:
        if not self.configured_for_tts:
            raise DomainError(
                code="tts_adapter_unavailable",
                message="OpenAI-compatible text-to-speech is not configured; display the prompt as text.",
                status_code=503,
            )
        client = self._client()
        try:
            async with client.audio.speech.with_streaming_response.create(
                model=self._settings.azure_openai_tts_deployment,
                voice=self._settings.azure_openai_tts_voice,
                input=text,
                response_format="wav",
            ) as response:
                return b"".join([chunk async for chunk in response.iter_bytes()])
        except (APIError, APIConnectionError, APITimeoutError) as exc:
            raise DomainError(
                code="tts_adapter_unavailable",
                message="OpenAI-compatible text-to-speech is unavailable; display the prompt as text.",
                status_code=503,
            ) from exc
        finally:
            await client.close()


class OpenAICompatibleVisionExtractor:
    """Image extraction through AsyncOpenAI; extracted content remains unverified evidence."""

    def __init__(self, settings: Settings):
        self._settings = settings

    @property
    def configured(self) -> bool:
        return bool(self._settings.llm_base_url and self._settings.llm_api_key and self._settings.llm_model)

    async def extract_image(self, content: bytes, mime_type: str, document_type: str) -> AdapterOutput:
        if not self.configured:
            raise DomainError(
                code="vision_extraction_unavailable",
                message="OpenAI-compatible vision extraction is not configured; use manual review.",
                status_code=503,
            )
        image_data_url = f"data:{mime_type};base64,{base64.b64encode(content).decode('ascii')}"
        prompt = get_prompt("document_extraction")
        client = AsyncOpenAI(
            base_url=self._settings.llm_base_url,
            api_key=self._settings.llm_api_key,
            timeout=self._settings.llm_timeout_seconds,
        )
        try:
            response = await client.chat.completions.create(
                model=self._settings.llm_model,
                messages=[
                    {"role": "system", "content": prompt.text},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"Document type: {document_type}. Extract the visible text."},
                            {"type": "image_url", "image_url": {"url": image_data_url}},
                        ],
                    },
                ],
            )
            response_text = response.choices[0].message.content
            if not isinstance(response_text, str):
                raise ValueError("Vision provider response content is not text")
            extraction = VisionExtraction.model_validate_json(response_text)
            return AdapterOutput(
                raw_text=extraction.extracted_text,
                structured_data={
                    "entities": [entity.model_dump() for entity in extraction.entities],
                    "requires_clinician_verification": True,
                    "prompt": prompt.metadata,
                },
                confidence=None,
                provider="openai_compatible_vision",
            )
        except (APIError, APIConnectionError, APITimeoutError, IndexError, TypeError, ValueError, ValidationError) as exc:
            raise DomainError(
                code="vision_extraction_unavailable",
                message="OpenAI-compatible vision extraction is unavailable or returned invalid output; use manual review.",
                status_code=503,
            ) from exc
        finally:
            await client.close()
