import base64
import hashlib
import logging
import struct
from dataclasses import dataclass
from uuid import UUID, uuid4

import fitz
from openai import APIConnectionError, APIError, APITimeoutError, AsyncAzureOpenAI, AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import DomainError
from app.models.entities import QuestionAudioPrompt
from app.prompting.registry import get_prompt
from app.services.storage import AzureBlobDocumentStorage

logger = logging.getLogger(__name__)


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
        raise DomainError(
            code="unknown_speech_fixture", message="Unknown synthetic speech fixture", status_code=422
        )
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
        raise DomainError(
            code="unknown_ocr_fixture", message="Unknown synthetic OCR fixture", status_code=422
        )
    return output


class OpenAICompatibleSpeechAdapter:
    """Azure STT adapter with the existing generic OpenAI-compatible TTS client."""

    def __init__(self, settings: Settings):
        self._settings = settings

    @property
    def configured_for_stt(self) -> bool:
        return bool(
            self._settings.azure_openai_endpoint
            and self._api_key
            and self._settings.azure_openai_stt_deployment
        )

    @property
    def configured_for_tts(self) -> bool:
        return bool(self._base_url and self._api_key and self._settings.azure_openai_tts_deployment)

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

    def _stt_client(self) -> AsyncAzureOpenAI:
        """Use Azure's deployment-style audio endpoint, not the generic `/openai/v1` route."""
        return AsyncAzureOpenAI(
            azure_endpoint=self._settings.azure_openai_endpoint,
            api_key=self._api_key,
            api_version=self._settings.azure_openai_api_version,
            timeout=self._settings.llm_timeout_seconds,
        )

    async def transcribe(self, content: bytes, filename: str, mime_type: str, language: str) -> AdapterOutput:
        if not self.configured_for_stt:
            raise DomainError(
                code="speech_adapter_unavailable",
                message="OpenAI-compatible speech transcription is not configured; use touch input.",
                status_code=503,
            )
        client = self._stt_client()
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
                            {
                                "type": "text",
                                "text": f"Document type: {document_type}. Extract the visible text.",
                            },
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
        except (
            APIError,
            APIConnectionError,
            APITimeoutError,
            IndexError,
            TypeError,
            ValueError,
            ValidationError,
        ) as exc:
            raise DomainError(
                code="vision_extraction_unavailable",
                message=(
                    "OpenAI-compatible vision extraction is unavailable or returned invalid output; "
                    "use manual review."
                ),
                status_code=503,
            ) from exc
        finally:
            await client.close()

    async def extract_pdf(self, content: bytes, document_type: str) -> AdapterOutput:
        """Extract native PDF text and render each page to a Luna-readable PNG.

        Page images stay in memory. The source PDF remains the evidence object in private Blob
        Storage; the saved artifact preserves page-scoped output and never becomes a clinical fact.
        """
        if not self.configured:
            raise DomainError(
                code="vision_extraction_unavailable",
                message="OpenAI-compatible vision extraction is not configured; use manual review.",
                status_code=503,
            )
        try:
            pdf = fitz.open(stream=content, filetype="pdf")
        except (fitz.FileDataError, RuntimeError, ValueError) as exc:
            raise DomainError(
                code="pdf_processing_unavailable",
                message="The uploaded PDF could not be read; use manual review.",
                status_code=422,
            ) from exc
        try:
            page_count = pdf.page_count
            if page_count < 1:
                raise DomainError(
                    code="pdf_processing_unavailable",
                    message="The uploaded PDF has no readable pages; use manual review.",
                    status_code=422,
                )
            if page_count > self._settings.pdf_max_pages:
                raise DomainError(
                    code="pdf_page_limit_exceeded",
                    message=(
                        f"PDF has {page_count} pages; the configured maximum is "
                        f"{self._settings.pdf_max_pages}."
                    ),
                    status_code=422,
                )
            scale = max(self._settings.pdf_render_dpi, 72) / 72
            pages: list[dict] = []
            native_pages: list[str] = []
            for page_number, page in enumerate(pdf, start=1):
                native_text = page.get_text("text").strip()
                native_pages.append(native_text)
                page_image = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False).tobytes("png")
                vision = await self.extract_image(page_image, "image/png", document_type)
                pages.append(
                    {
                        "page_number": page_number,
                        "native_text": native_text,
                        "vision_text": vision.raw_text,
                        "entities": vision.structured_data["entities"],
                    }
                )
            native_text = "\n\n".join(text for text in native_pages if text)
            combined_text = native_text or "\n\n".join(page["vision_text"] for page in pages)
            prompt = get_prompt("document_extraction")
            return AdapterOutput(
                raw_text=combined_text,
                structured_data={
                    "document_kind": "pdf",
                    "page_count": page_count,
                    "native_text": native_text,
                    "pages": pages,
                    "rendering": {"engine": "pymupdf", "format": "png", "dpi": self._settings.pdf_render_dpi},
                    "requires_clinician_verification": True,
                    "prompt": prompt.metadata,
                },
                confidence=None,
                provider="pymupdf_luna_vision",
            )
        except DomainError:
            raise
        except (fitz.FileDataError, RuntimeError, ValueError) as exc:
            raise DomainError(
                code="pdf_processing_unavailable",
                message="PDF page rendering or vision extraction failed; use manual review.",
                status_code=503,
            ) from exc
        finally:
            pdf.close()


def generate_mock_wav(duration_seconds: float = 0.5, sample_rate: int = 16000) -> bytes:
    num_samples = int(sample_rate * duration_seconds)
    data_size = num_samples * 2  # 16-bit mono
    riff_chunk_size = 36 + data_size
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        riff_chunk_size,
        b"WAVE",
        b"fmt ",
        16,  # Subchunk1Size (16 for PCM)
        1,  # AudioFormat (1 for PCM)
        1,  # NumChannels (1 for mono)
        sample_rate,
        sample_rate * 2,  # ByteRate
        2,  # BlockAlign
        16,  # BitsPerSample
        b"data",
        data_size,
    )
    return header + (b"\x00" * data_size)


async def get_or_synthesize_question_audio(
    session: AsyncSession,
    settings: Settings,
    question_key: str,
    prompt_text: str,
    language: str = "en",
) -> tuple[bytes, UUID, bool]:
    """Retrieve or synthesize a prompt, then cache it in Blob Storage and the database."""
    norm_lang = (language or "en").strip().lower()
    norm_prompt = prompt_text.strip()
    prompt_hash = hashlib.sha256(f"{norm_lang}:{norm_prompt}".encode()).hexdigest()

    cached = await session.scalar(
        select(QuestionAudioPrompt).where(QuestionAudioPrompt.prompt_hash == prompt_hash)
    )

    if cached is not None:
        try:
            storage = AzureBlobDocumentStorage(settings)
            stream = await storage.download(cached.storage_key)
            audio_bytes = b"".join([chunk async for chunk in stream])
            if audio_bytes:
                return audio_bytes, cached.id, True
        except Exception as exc:
            logger.warning("Failed to fetch cached audio prompt %s from storage: %s", cached.storage_key, exc)

    # Synthesis needed (cache miss or blob download failed)
    adapter_mode = settings.speech_adapter_mode.strip().lower()
    if adapter_mode == "openai_compatible":
        audio_bytes = await OpenAICompatibleSpeechAdapter(settings).synthesize(norm_prompt)
        provider = "openai_compatible"
    elif adapter_mode == "mock":
        audio_bytes = generate_mock_wav()
        provider = "mock"
    elif adapter_mode == "disabled":
        raise DomainError(
            code="tts_adapter_unavailable",
            message="Text-to-speech is disabled; display the question as text.",
            status_code=503,
        )
    else:
        raise DomainError(
            code="tts_adapter_misconfigured",
            message="Speech adapter mode is invalid; use disabled, mock, or openai_compatible.",
            status_code=503,
        )

    storage_key = f"question_audio/{question_key}_{prompt_hash[:16]}.wav"
    prompt_id = cached.id if cached is not None else uuid4()

    # Upload to Azure Blob Storage
    try:
        storage = AzureBlobDocumentStorage(settings)
        await storage.upload(storage_key, audio_bytes, "audio/wav", overwrite=True)
    except Exception as exc:
        logger.warning("Could not persist question audio to Azure Blob Storage: %s", exc)

    if cached is None:
        new_prompt = QuestionAudioPrompt(
            id=prompt_id,
            question_key=question_key,
            language=norm_lang,
            prompt_text=norm_prompt,
            prompt_hash=prompt_hash,
            storage_key=storage_key,
            mime_type="audio/wav",
            size_bytes=len(audio_bytes),
            provider=provider,
        )
        session.add(new_prompt)
        await session.flush()

    return audio_bytes, prompt_id, False
