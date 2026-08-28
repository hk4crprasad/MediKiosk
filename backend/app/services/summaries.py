from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import ClinicalFact, Summary
from app.prompting.registry import get_prompt
from app.services.openai_compatible import PROMPT_VERSION, OpenAICompatibleSummaryGenerator


async def build_summary_content(session: AsyncSession, encounter_id) -> tuple[dict, str]:
    facts = (
        await session.scalars(
            select(ClinicalFact)
            .where(ClinicalFact.encounter_id == encounter_id)
            .order_by(ClinicalFact.created_at.asc())
        )
    ).all()
    values = {fact.fact_type: fact.value.get("value") for fact in facts}
    ayush_values = {
        key.removeprefix("ayush_"): value for key, value in values.items() if key.startswith("ayush_")
    }
    clinical_pathway_values_present = any(
        key in values for key in ("chief_complaint", "onset_duration", "allergies", "current_medications")
    )
    if ayush_values and not clinical_pathway_values_present:
        ayush_text = "; ".join(
            f"{key.replace('_', ' ')}: {value if value is not None else 'Not captured'}"
            for key, value in ayush_values.items()
        )
        content = {"ayush_assessment": ayush_values}
        return content, f"AYUSH intake (patient-reported, pending clinician review): {ayush_text}."

    base_keys = {"chief_complaint", "onset_duration", "allergies", "current_medications"}
    chest_hpi_keys = {"chest_onset", "chest_character", "chest_radiation", "chest_severity", "chest_timing"}
    associated_symptoms = {
        key: value
        for key, value in values.items()
        if key not in base_keys | chest_hpi_keys and not key.startswith("ayush_")
    }
    content = {
        "chief_complaint": values.get("chief_complaint", "Not captured"),
        "onset_duration": values.get("onset_duration", "Not captured"),
        "associated_symptoms": associated_symptoms,
        "allergies": values.get("allergies", "Not captured"),
        "current_medications": values.get("current_medications", "Not captured"),
    }
    if values.get("chief_complaint") == "chest_discomfort":
        content["hpi"] = {
            "onset": values.get("chest_onset", "Not captured"),
            "character": values.get("chest_character", "Not captured"),
            "radiation": values.get("chest_radiation", "Not captured"),
            "severity": values.get("chest_severity", "Not captured"),
            "timing": values.get("chest_timing", "Not captured"),
        }
    if ayush_values:
        content["ayush_assessment"] = ayush_values

    symptom_text = (
        "; ".join(
            f"{key.replace('_', ' ')}: {value if value is not None else 'Not captured'}"
            for key, value in associated_symptoms.items()
        )
        or "Not captured"
    )
    if "hpi" in content:
        hpi_text = "; ".join(f"{key}: {value}" for key, value in content["hpi"].items())
        text = (
            f"Chief complaint: {content['chief_complaint']}. HPI: {hpi_text}. "
            f"Associated details: {symptom_text}. Allergies: {content['allergies']}. "
            f"Current medications: {content['current_medications']}."
        )
    else:
        text = (
            f"Chief complaint: {content['chief_complaint']}. "
            f"Onset/duration: {content['onset_duration']}. "
            f"Associated details: {symptom_text}. Allergies: {content['allergies']}. "
            f"Current medications: {content['current_medications']}."
        )
    if ayush_values:
        ayush_text = "; ".join(
            f"{key.replace('_', ' ')}: {value if value is not None else 'Not captured'}"
            for key, value in ayush_values.items()
        )
        text = f"{text} AYUSH intake: {ayush_text}."
    return content, text


async def generate_summary(session: AsyncSession, encounter_id) -> Summary:
    content, template_text = await build_summary_content(session, encounter_id)
    generator = OpenAICompatibleSummaryGenerator(get_settings())
    prompt = get_prompt("summary")
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
    summary = Summary(
        encounter_id=encounter_id,
        content=content,
        text=summary_text,
        source=source,
        prompt_version=prompt_version,
        prompt_metadata=prompt.metadata,
    )
    session.add(summary)
    return summary
