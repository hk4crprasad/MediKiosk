from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_session
from app.core.errors import DomainError
from app.core.security import Principal, get_principal
from app.models import AssistiveArtifact, Document
from app.models.entities import DocumentStatus
from app.schemas.assistive import AssistiveArtifactResponse, DocumentExtractionRequest
from app.services.access import ensure_encounter_access, get_encounter_or_404
from app.services.assistive import OpenAICompatibleSpeechAdapter, mock_document_extraction, mock_transcription
from app.services.audit import write_audit
from app.services.intake import ensure_active_consent, next_question

router = APIRouter(tags=["assistive-adapters"])
SUPPORTED_AUDIO_MIME_TYPES = {"audio/wav", "audio/x-wav", "audio/mpeg"}


def has_expected_audio_signature(content: bytes, mime_type: str) -> bool:
    if mime_type in {"audio/wav", "audio/x-wav"}:
        return content.startswith(b"RIFF") and content[8:12] == b"WAVE"
    if mime_type == "audio/mpeg":
        return content.startswith(b"ID3") or content.startswith(b"\xff\xfb")
    return False


async def get_document_or_404(session: AsyncSession, document_id: UUID) -> Document:
    document = await session.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.post(
    "/encounters/{encounter_id}/speech/transcriptions",
    response_model=AssistiveArtifactResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_transcription(
    encounter_id: UUID,
    request: Request,
    audio: UploadFile = File(...),
    language: str = Form(default="en"),
    fixture_id: str = Form(default="en_general_v1"),
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> AssistiveArtifactResponse:
    ensure_encounter_access(principal, encounter_id)
    await ensure_active_consent(session, encounter_id)
    if audio.content_type not in SUPPORTED_AUDIO_MIME_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only WAV and MP3 synthetic audio is accepted")
    content = await audio.read(get_settings().max_upload_bytes + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Audio upload is empty")
    if len(content) > get_settings().max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Audio upload is too large")
    if not has_expected_audio_signature(content, audio.content_type):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Audio content does not match its declared type")

    settings = get_settings()
    adapter_mode = settings.speech_adapter_mode.strip().lower()
    if adapter_mode == "mock":
        output = mock_transcription(adapter_mode, fixture_id, language)
    elif adapter_mode == "openai_compatible":
        output = await OpenAICompatibleSpeechAdapter(settings).transcribe(
            content, audio.filename or "audio.wav", audio.content_type, language
        )
    elif adapter_mode == "disabled":
        raise DomainError(
            code="speech_adapter_unavailable",
            message="Speech adapter is disabled; use touch input.",
            status_code=503,
        )
    else:
        raise DomainError(
            code="speech_adapter_misconfigured",
            message="Speech adapter mode is invalid; use disabled, mock, or openai_compatible.",
            status_code=503,
        )
    artifact = AssistiveArtifact(
        encounter_id=encounter_id,
        artifact_type="speech_transcription",
        provider=output.provider,
        status="COMPLETED",
        language=output.language,
        raw_text=output.raw_text,
        structured_data=output.structured_data,
        confidence=output.confidence,
    )
    session.add(artifact)
    await session.flush()
    await write_audit(
        session,
        "assistive.speech_transcription_created",
        actor_id=principal.subject if principal.token_type == "staff" else None,
        encounter_id=encounter_id,
        request=request,
        metadata={"artifact_id": str(artifact.id), "provider": output.provider, "fixture_id": fixture_id},
    )
    await session.commit()
    await session.refresh(artifact)
    return AssistiveArtifactResponse.model_validate(artifact)


@router.post("/encounters/{encounter_id}/audio/prompts/next-question", response_class=Response)
async def synthesize_next_question_prompt(
    encounter_id: UUID,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Speak only the server-configured next question; never arbitrary or generated clinical text."""
    ensure_encounter_access(principal, encounter_id)
    encounter = await get_encounter_or_404(session, encounter_id)
    await ensure_active_consent(session, encounter_id)
    question = await next_question(session, encounter)
    if question is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The configured pathway is already complete")
    settings = get_settings()
    if settings.speech_adapter_mode.strip().lower() != "openai_compatible":
        raise DomainError(
            code="tts_adapter_unavailable",
            message="Text-to-speech is not configured; display the next question as text.",
            status_code=503,
        )
    audio_content = await OpenAICompatibleSpeechAdapter(settings).synthesize(question["prompt"])
    await write_audit(
        session,
        "assistive.next_question_prompt_synthesized",
        actor_id=principal.subject if principal.token_type == "staff" else None,
        encounter_id=encounter_id,
        request=request,
        metadata={"question_key": question["key"], "provider": "openai_compatible"},
    )
    await session.commit()
    return Response(
        content=audio_content,
        media_type="audio/wav",
        headers={"X-MediKiosk-Question-Key": question["key"], "Content-Disposition": 'inline; filename="next-question.wav"'},
    )


@router.post("/documents/{document_id}/extractions", response_model=AssistiveArtifactResponse, status_code=status.HTTP_201_CREATED)
async def create_mock_document_extraction(
    document_id: UUID,
    payload: DocumentExtractionRequest,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> AssistiveArtifactResponse:
    document = await get_document_or_404(session, document_id)
    ensure_encounter_access(principal, document.encounter_id)
    await ensure_active_consent(session, document.encounter_id)
    output = mock_document_extraction(get_settings().ocr_adapter_mode, payload.fixture_id)
    artifact = AssistiveArtifact(
        encounter_id=document.encounter_id,
        document_id=document.id,
        artifact_type="document_extraction",
        provider="mock",
        status="COMPLETED",
        raw_text=output.raw_text,
        structured_data=output.structured_data,
        confidence=output.confidence,
    )
    document.processing_status = DocumentStatus.processed
    session.add(artifact)
    await session.flush()
    await write_audit(
        session,
        "assistive.document_extraction_created",
        actor_id=principal.subject if principal.token_type == "staff" else None,
        encounter_id=document.encounter_id,
        request=request,
        metadata={"artifact_id": str(artifact.id), "document_id": str(document.id), "provider": "mock", "fixture_id": payload.fixture_id},
    )
    await session.commit()
    await session.refresh(artifact)
    return AssistiveArtifactResponse.model_validate(artifact)


@router.get("/documents/{document_id}/extractions/latest", response_model=AssistiveArtifactResponse)
async def get_latest_document_extraction(
    document_id: UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> AssistiveArtifactResponse:
    document = await get_document_or_404(session, document_id)
    ensure_encounter_access(principal, document.encounter_id)
    artifact = await session.scalar(
        select(AssistiveArtifact)
        .where(AssistiveArtifact.document_id == document_id, AssistiveArtifact.artifact_type == "document_extraction")
        .order_by(AssistiveArtifact.created_at.desc())
    )
    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document extraction not found")
    return AssistiveArtifactResponse.model_validate(artifact)
