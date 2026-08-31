from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clinical_config.pathways import active_questions, is_supported_pathway
from app.clinical_config.red_flags import RULE_SET_VERSION, rules_for_pathway
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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Active clinical-intake consent is required"
        )


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
    question, _index, _total = await next_question_progress(session, encounter)
    return question


async def next_question_progress(session: AsyncSession, encounter: Encounter) -> tuple[dict | None, int, int]:
    """Return the next unanswered question plus its 1-based position and the
    current total question count for the pathway (both change as conditional
    follow-up questions become active, so this is recomputed on every call)."""
    if not is_supported_pathway(encounter.pathway_version):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Configured pathway version is not available"
        )
    answers = await answer_map(session, encounter.id)
    sequence = active_questions(encounter.pathway_version, answers)
    total = len(sequence)
    for index, question in enumerate(sequence, start=1):
        if question["key"] not in answers:
            return question, index, total
    return None, total, total


async def submit_response(
    session: AsyncSession, encounter: Encounter, payload: IntakeResponseCreateRequest
) -> tuple[PatientResponse, list[ClinicalFact], list[RedFlag]]:
    await ensure_active_consent(session, encounter.id)
    if encounter.status not in {
        EncounterStatus.draft,
        EncounterStatus.in_progress,
        EncounterStatus.urgent_review,
    }:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Encounter cannot accept intake responses"
        )

    answers = await answer_map(session, encounter.id)
    question = await next_question(session, encounter)
    if question is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="The configured pathway is already complete"
        )
    if payload.question_key != question["key"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Response is out of sequence", "expected_question_key": question["key"]},
        )
    if question["input_type"] != "single_choice":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Configured kiosk question is invalid"
        )
    if payload.value not in question["choices"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Response is not an allowed choice", "allowed_choices": question["choices"]},
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


async def evaluate_red_flags(
    session: AsyncSession, encounter: Encounter, answers: dict[str, object]
) -> list[RedFlag]:
    triggered: list[RedFlag] = []
    for rule in rules_for_pathway(encounter.pathway_version):
        if not rule.condition(answers):
            continue
        existing = await session.scalar(
            select(RedFlag).where(
                RedFlag.encounter_id == encounter.id,
                RedFlag.rule_id == rule.rule_id,
                RedFlag.active.is_(True),
            )
        )
        if existing:
            triggered.append(existing)
            continue
        facts = (
            await session.scalars(
                select(ClinicalFact).where(
                    ClinicalFact.encounter_id == encounter.id,
                    ClinicalFact.fact_type.in_(rule.evidence_fact_types),
                )
            )
        ).all()
        flag = RedFlag(
            encounter_id=encounter.id,
            rule_id=rule.rule_id,
            rule_version=RULE_SET_VERSION,
            severity=RedFlagSeverity(rule.severity),
            reason=rule.reason,
            evidence_fact_ids=[str(item.id) for item in facts],
        )
        session.add(flag)
        encounter.status = EncounterStatus.urgent_review
        triggered.append(flag)
    return triggered


async def required_missing(session: AsyncSession, encounter: Encounter) -> list[str]:
    if not is_supported_pathway(encounter.pathway_version):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Configured pathway version is not available"
        )
    answers = await answer_map(session, encounter.id)
    return [
        question["key"]
        for question in active_questions(encounter.pathway_version, answers)
        if question["required"] and question["key"] not in answers
    ]
