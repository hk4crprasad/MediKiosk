from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clinical_config.pathways import localise_question
from app.core.config import get_settings
from app.core.database import get_session
from app.core.errors import DomainError
from app.core.security import Principal, get_principal, require_staff
from app.models import AssistiveArtifact, ClinicalFact, Document, Patient
from app.models.entities import DocumentStatus, VerificationStatus
from app.schemas.assistive import (
    AssistiveArtifactResponse,
    DocumentExtractionRequest,
    DocumentExtractionReviewRequest,
    DocumentExtractionReviewResponse,
)
from app.services.access import ensure_encounter_access, get_encounter_or_404
from app.services.assistive import (
    OpenAICompatibleSpeechAdapter,
    OpenAICompatibleVisionExtractor,
    get_or_synthesize_question_audio,
    mock_document_extraction,
    mock_transcription,
)
from app.services.audio_formats import (
    SUPPORTED_AUDIO_MIME_TYPES,
    audio_extension,
    has_expected_audio_signature,
    normalise_audio_mime_type,
)
from app.services.audit import write_audit
from app.services.intake import ensure_active_consent, next_question
from app.services.storage import AzureBlobDocumentStorage

router = APIRouter(tags=["assistive-adapters"])


async def get_document_or_404(session: AsyncSession, document_id: UUID) -> Document:
    document = await session.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


async def read_private_document(document: Document) -> bytes:
    stream = await AzureBlobDocumentStorage(get_settings()).download(document.storage_key)
    content = b"".join([chunk async for chunk in stream])
    if not content:
        raise DomainError("document_content_not_found", "Document content is unavailable", status_code=404)
    return content


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
    audio_mime_type = normalise_audio_mime_type(audio.content_type)
    if audio_mime_type not in SUPPORTED_AUDIO_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Supported audio formats are WebM/Opus, Ogg/Opus, M4A/MP4, WAV, and MP3.",
        )
    content = await audio.read(get_settings().max_upload_bytes + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Audio upload is empty")
    if len(content) > get_settings().max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Audio upload is too large"
        )
    if not has_expected_audio_signature(content, audio_mime_type):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Audio content does not match its declared type",
        )

    settings = get_settings()
    adapter_mode = settings.speech_adapter_mode.strip().lower()
    if adapter_mode == "mock":
        output = mock_transcription(adapter_mode, fixture_id, language)
    elif adapter_mode == "openai_compatible":
        output = await OpenAICompatibleSpeechAdapter(settings).transcribe(
            content,
            audio.filename or f"audio.{audio_extension(audio_mime_type)}",
            audio_mime_type,
            language,
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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="The configured pathway is already complete"
        )
    settings = get_settings()
    patient = await session.get(Patient, encounter.patient_id)
    language = (patient.preferred_language if patient and patient.preferred_language else "en") or "en"
    question = localise_question(question, language)
    audio_content, prompt_id, is_cached = await get_or_synthesize_question_audio(
        session=session,
        settings=settings,
        question_key=question["key"],
        prompt_text=question["prompt"],
        language=language,
    )
    await write_audit(
        session,
        "assistive.next_question_prompt_audio_served",
        actor_id=principal.subject if principal.token_type == "staff" else None,
        encounter_id=encounter_id,
        request=request,
        metadata={
            "question_key": question["key"],
            "prompt_id": str(prompt_id),
            "cached": is_cached,
            "provider": settings.speech_adapter_mode,
        },
    )
    await session.commit()
    return Response(
        content=audio_content,
        media_type="audio/wav",
        headers={
            "X-MediKiosk-Question-Key": question["key"],
            "X-MediKiosk-Audio-Prompt-Id": str(prompt_id),
            "X-MediKiosk-Audio-Cached": "true" if is_cached else "false",
            "Content-Disposition": 'inline; filename="next-question.wav"',
        },
    )


@router.post(
    "/documents/{document_id}/extractions",
    response_model=AssistiveArtifactResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_document_extraction(
    document_id: UUID,
    payload: DocumentExtractionRequest,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> AssistiveArtifactResponse:
    document = await get_document_or_404(session, document_id)
    ensure_encounter_access(principal, document.encounter_id)
    await ensure_active_consent(session, document.encounter_id)
    settings = get_settings()
    adapter_mode = settings.ocr_adapter_mode.strip().lower()
    document.processing_status = DocumentStatus.processing
    await session.commit()
    try:
        if adapter_mode == "mock":
            output = mock_document_extraction(adapter_mode, payload.fixture_id)
        elif adapter_mode == "openai_compatible":
            extractor = OpenAICompatibleVisionExtractor(settings)
            source_content = await read_private_document(document)
            if document.mime_type in {"image/jpeg", "image/png"}:
                output = await extractor.extract_image(
                    source_content, document.mime_type, document.document_type
                )
            elif document.mime_type == "application/pdf":
                output = await extractor.extract_pdf(source_content, document.document_type)
            else:
                raise DomainError(
                    code="vision_extraction_unsupported_document",
                    message="Document extraction supports PDF, JPEG, and PNG documents only.",
                    status_code=422,
                )
        elif adapter_mode == "disabled":
            raise DomainError(
                code="ocr_adapter_unavailable",
                message="Document extraction is disabled; use manual review.",
                status_code=503,
            )
        else:
            raise DomainError(
                code="ocr_adapter_misconfigured",
                message="Document extraction mode is invalid; use disabled, mock, or openai_compatible.",
                status_code=503,
            )
    except DomainError:
        document.processing_status = DocumentStatus.failed
        await write_audit(
            session,
            "assistive.document_extraction_failed",
            actor_id=principal.subject if principal.token_type == "staff" else None,
            encounter_id=document.encounter_id,
            request=request,
            metadata={"document_id": str(document.id), "provider_mode": adapter_mode},
        )
        await session.commit()
        raise
    artifact = AssistiveArtifact(
        encounter_id=document.encounter_id,
        document_id=document.id,
        artifact_type="document_extraction",
        provider=output.provider,
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
        metadata={
            "artifact_id": str(artifact.id),
            "document_id": str(document.id),
            "provider": output.provider,
            "fixture_id": payload.fixture_id if adapter_mode == "mock" else None,
            "prompt": output.structured_data.get("prompt"),
        },
    )
    await session.commit()
    await session.refresh(artifact)
    return AssistiveArtifactResponse.model_validate(artifact)


@router.post(
    "/documents/{document_id}/extractions/{extraction_id}/reviews",
    response_model=DocumentExtractionReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def review_document_extraction(
    document_id: UUID,
    extraction_id: UUID,
    payload: DocumentExtractionReviewRequest,
    request: Request,
    principal: Principal = Depends(require_staff("admin", "physician")),
    session: AsyncSession = Depends(get_session),
) -> DocumentExtractionReviewResponse:
    """Record physician review; only explicitly submitted facts become clinician-verified."""
    document = await get_document_or_404(session, document_id)
    extraction = await session.get(AssistiveArtifact, extraction_id)
    if (
        extraction is None
        or extraction.document_id != document.id
        or extraction.artifact_type != "document_extraction"
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document extraction not found")
    if payload.decision == "rejected" and payload.promoted_facts:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Rejected extractions cannot promote clinical facts",
        )
    review = AssistiveArtifact(
        encounter_id=document.encounter_id,
        document_id=document.id,
        artifact_type="document_extraction_review",
        provider="clinician",
        status=payload.decision.upper(),
        raw_text=payload.note or "Clinician reviewed document extraction.",
        structured_data={
            "reviewed_extraction_id": str(extraction.id),
            "decision": payload.decision,
            "note": payload.note,
            "requires_clinician_verification": False,
        },
        confidence=None,
    )
    session.add(review)
    await session.flush()
    promoted_fact_ids: list[UUID] = []
    promoted_fact_details: list[dict] = []
    for item in payload.promoted_facts:
        fact = ClinicalFact(
            encounter_id=document.encounter_id,
            fact_type=item.fact_type,
            value=item.value,
            source_type="document",
            source_id=document.id,
            source_excerpt=item.source_excerpt,
            confidence=None,
            verification_status=VerificationStatus.clinician_verified,
        )
        session.add(fact)
        await session.flush()
        promoted_fact_ids.append(fact.id)
        promoted_fact_details.append({"fact_id": str(fact.id), "page_number": item.page_number})
    review.structured_data["promoted_fact_ids"] = [str(fact_id) for fact_id in promoted_fact_ids]
    review.structured_data["promoted_facts"] = promoted_fact_details
    await write_audit(
        session,
        "assistive.document_extraction_reviewed",
        actor_id=principal.subject,
        encounter_id=document.encounter_id,
        request=request,
        metadata={
            "document_id": str(document.id),
            "extraction_id": str(extraction.id),
            "review_id": str(review.id),
            "decision": payload.decision,
            "promoted_fact_ids": [str(fact_id) for fact_id in promoted_fact_ids],
        },
    )
    await session.commit()
    await session.refresh(review)
    return DocumentExtractionReviewResponse(
        review=AssistiveArtifactResponse.model_validate(review),
        promoted_fact_ids=promoted_fact_ids,
    )


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
        .where(
            AssistiveArtifact.document_id == document_id,
            AssistiveArtifact.artifact_type == "document_extraction",
        )
        .order_by(AssistiveArtifact.created_at.desc())
    )
    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document extraction not found")
    return AssistiveArtifactResponse.model_validate(artifact)
