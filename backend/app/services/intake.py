from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clinical_config.pathways import PATHWAY_VERSION, active_questions
from app.clinical_config.red_flags import (
    CHEST_BREATHLESSNESS_REASON,
    CHEST_BREATHLESSNESS_RULE_ID,
    RULE_VERSION,
)
from app.models import ClinicalFact, Consent, Encounter, PatientResponse, RedFlag
from app.models.entities import EncounterStatus, RedFlagSeverity, VerificationStatus
from app.schemas.intake import IntakeResponseCreateRequest


async def ensure_active_consent(session: AsyncSession, encounter_id: UUID) -> None:
    consent = await session.scalar(
        select(Consent).where(
            Consent.encounter_id == encounter_id,
            Consent.consent_type == "clinical_intake",
            Consent.granted.is_(True),
            Consent.revoked_at.is_(None),
        )
    )
    if consent is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Active clinical-intake consent is required")


async def answer_map(session: AsyncSession, encounter_id: UUID) -> dict[str, object]:
    responses = (
        await session.scalars(
            select(PatientResponse)
            .where(PatientResponse.encounter_id == encounter_id)
            .order_by(PatientResponse.created_at.asc())
        )
    ).all()
    return {response.question_key: response.normalized_value.get("value") for response in responses}


async def next_question(session: AsyncSession, encounter: Encounter) -> dict | None:
    if encounter.pathway_version != PATHWAY_VERSION:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Configured pathway version is not available")
    answers = await answer_map(session, encounter.id)
    for question in active_questions(answers):
        if question["key"] not in answers:
            return question
    return None


async def submit_response(
    session: AsyncSession, encounter: Encounter, payload: IntakeResponseCreateRequest
) -> tuple[PatientResponse, list[ClinicalFact], list[RedFlag]]:
    await ensure_active_consent(session, encounter.id)
    if encounter.status not in {EncounterStatus.draft, EncounterStatus.in_progress, EncounterStatus.urgent_review}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Encounter cannot accept intake responses")

    answers = await answer_map(session, encounter.id)
    question = await next_question(session, encounter)
    if question is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The configured pathway is already complete")
    if payload.question_key != question["key"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Response is out of sequence", "expected_question_key": question["key"]},
        )
    if question["input_type"] == "single_choice" and payload.value not in question["choices"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Response is not an allowed choice", "allowed_choices": question["choices"]},
        )
    if question["input_type"] == "boolean" and not (
        isinstance(payload.value, bool) or payload.value in ("yes", "no", "Yes", "No")
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Boolean questions accept true/false or yes/no only",
        )

    normalized_value = {"value": payload.value}
    response = PatientResponse(
        encounter_id=encounter.id,
        question_key=payload.question_key,
        input_mode=payload.input_mode,
        raw_text=payload.raw_text,
        normalized_value=normalized_value,
        language=payload.language,
    )
    session.add(response)
    await session.flush()
    fact = ClinicalFact(
        encounter_id=encounter.id,
        fact_type=payload.question_key,
        value=normalized_value,
        source_type="patient_response",
        source_id=response.id,
        source_excerpt=payload.raw_text,
        verification_status=VerificationStatus.patient_confirmed,
    )
    session.add(fact)
    await session.flush()

    if encounter.status == EncounterStatus.draft:
        encounter.status = EncounterStatus.in_progress
    flags = await evaluate_red_flags(session, encounter, {**answers, payload.question_key: payload.value})
    return response, [fact], flags


async def evaluate_red_flags(session: AsyncSession, encounter: Encounter, answers: dict[str, object]) -> list[RedFlag]:
    triggered: list[RedFlag] = []
    is_triggered = answers.get("chief_complaint") == "chest_discomfort" and answers.get("breathlessness") in {
        True,
        "yes",
        "Yes",
    }
    if not is_triggered:
        return triggered
    existing = await session.scalar(
        select(RedFlag).where(
            RedFlag.encounter_id == encounter.id,
            RedFlag.rule_id == CHEST_BREATHLESSNESS_RULE_ID,
            RedFlag.active.is_(True),
        )
    )
    if existing:
        return [existing]
    facts = (
        await session.scalars(
            select(ClinicalFact).where(
                ClinicalFact.encounter_id == encounter.id,
                ClinicalFact.fact_type.in_(["chief_complaint", "breathlessness"]),
            )
        )
    ).all()
    flag = RedFlag(
        encounter_id=encounter.id,
        rule_id=CHEST_BREATHLESSNESS_RULE_ID,
        rule_version=RULE_VERSION,
        severity=RedFlagSeverity.urgent,
        reason=CHEST_BREATHLESSNESS_REASON,
        evidence_fact_ids=[str(item.id) for item in facts],
    )
    session.add(flag)
    encounter.status = EncounterStatus.urgent_review
    triggered.append(flag)
    return triggered


async def required_missing(session: AsyncSession, encounter: Encounter) -> list[str]:
    answers = await answer_map(session, encounter.id)
    return [question["key"] for question in active_questions(answers) if question["required"] and question["key"] not in answers]
