"""Longitudinal AI overview across one patient account's own uploaded records.

Deliberately separate from app/services/summaries.py (which drafts a single clinical
encounter's physician summary). This synthesizes across many PatientRecord rows the
patient uploaded themselves — never a diagnosis, and never touching Encounter/Consent.
"""

import json
import logging
from uuid import UUID

from openai import APIError, APITimeoutError, AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.models import PatientAccount, PatientHistorySummary, PatientRecord, PatientRecordExtraction
from app.prompting.registry import get_prompt

logger = logging.getLogger(__name__)
PROMPT_VERSION = get_prompt("patient_history_summary").version


class GeneratedPatientHistorySummary(BaseModel):
    summary_text: str = Field(min_length=1, max_length=16000)


class PatientHistorySummaryGenerator:
    """Official OpenAI SDK client for the same base-URL-compatible provider used
    elsewhere in the app (gpt-5.6-luna via LLM_BASE_URL/LLM_API_KEY)."""

    def __init__(self, settings: Settings):
        self._base_url = settings.llm_base_url
        self._api_key = settings.llm_api_key
        self._model = settings.llm_model
        self._timeout = settings.llm_timeout_seconds

    @property
    def configured(self) -> bool:
        return bool(self._base_url and self._api_key)

    async def generate(self, structured_history: dict) -> GeneratedPatientHistorySummary:
        if not self.configured:
            raise RuntimeError("OpenAI-compatible generation is not configured")
        system_prompt = get_prompt("patient_history_summary").text
        client = AsyncOpenAI(api_key=self._api_key, base_url=self._base_url, timeout=self._timeout)
        try:
            response = await client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": "Patient records and extracted document text:\n"
                        + json.dumps(structured_history, ensure_ascii=False),
                    },
                ],
            )
            content = response.choices[0].message.content
            if not isinstance(content, str):
                raise ValueError("Provider response content is not text")
            return GeneratedPatientHistorySummary.model_validate_json(content)
        except (APIError, APITimeoutError, IndexError, TypeError, ValueError, ValidationError) as exc:
            logger.warning(
                "OpenAI-compatible patient history summary failed; template fallback will be used: %s", exc
            )
            raise RuntimeError("OpenAI-compatible provider output was unavailable or invalid") from exc
        finally:
            await client.close()


async def build_patient_history_content(
    session: AsyncSession, patient_account_id: UUID
) -> tuple[dict, str]:
    account = await session.get(PatientAccount, patient_account_id)
    records = (
        await session.scalars(
            select(PatientRecord)
            .where(PatientRecord.patient_account_id == patient_account_id)
            .order_by(PatientRecord.visit_date.asc().nullslast(), PatientRecord.created_at.asc())
        )
    ).all()
    record_ids = [record.id for record in records]
    extractions_by_record: dict[UUID, list[PatientRecordExtraction]] = {}
    if record_ids:
        extractions = (
            await session.scalars(
                select(PatientRecordExtraction)
                .where(PatientRecordExtraction.patient_record_id.in_(record_ids))
                .order_by(PatientRecordExtraction.created_at.asc())
            )
        ).all()
        for extraction in extractions:
            extractions_by_record.setdefault(extraction.patient_record_id, []).append(extraction)

    record_payloads = []
    for record in records:
        record_payloads.append(
            {
                "visit_date": record.visit_date.isoformat() if record.visit_date else "Not captured",
                "hospital_or_clinic": record.hospital_or_clinic or "Not captured",
                "visit_reason": record.visit_reason or "Not captured",
                "document_type": record.document_type,
                "original_filename": record.original_filename,
                "extracted_text": [
                    extraction.raw_text for extraction in extractions_by_record.get(record.id, [])
                ],
            }
        )
    content = {
        "patient": {
            "display_name": account.display_name if account else None,
            "birth_year": account.birth_year if account else None,
            "sex": account.sex if account else None,
        },
        "record_count": len(records),
        "records": record_payloads,
    }
    if not records:
        return content, "No documents have been uploaded to this patient's archive yet."
    lines = [
        f"{index}. {payload['visit_date']} at {payload['hospital_or_clinic']} "
        f"({payload['document_type']}): {payload['visit_reason']}"
        for index, payload in enumerate(record_payloads, start=1)
    ]
    text = f"{len(records)} record(s) on file. " + " ".join(lines)
    return content, text


async def generate_patient_history_summary(
    session: AsyncSession, patient_account_id: UUID
) -> PatientHistorySummary:
    content, template_text = await build_patient_history_content(session, patient_account_id)
    generator = PatientHistorySummaryGenerator(get_settings())
    prompt = get_prompt("patient_history_summary")
    source = "template"
    prompt_version = None
    summary_text = template_text
    if generator.configured:
        try:
            generated = await generator.generate(content)
            summary_text = generated.summary_text
            source = "openai_compatible"
            prompt_version = PROMPT_VERSION
        except RuntimeError:
            source = "template_fallback"
            prompt_version = PROMPT_VERSION
    summary = PatientHistorySummary(
        patient_account_id=patient_account_id,
        content=content,
        text=summary_text,
        source=source,
        prompt_version=prompt_version,
        prompt_metadata=prompt.metadata,
    )
    session.add(summary)
    return summary
