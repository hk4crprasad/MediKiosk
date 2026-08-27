from app.core.config import get_settings
from app.services.openai_compatible import OpenAICompatibleSummaryGenerator, PROMPT_VERSION
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ClinicalFact, Summary


async def build_summary_content(session: AsyncSession, encounter_id) -> tuple[dict, str]:
    facts = (
        await session.scalars(
            select(ClinicalFact).where(ClinicalFact.encounter_id == encounter_id).order_by(ClinicalFact.created_at.asc())
        )
    ).all()
    values = {fact.fact_type: fact.value.get("value") for fact in facts}
    content = {
        "chief_complaint": values.get("chief_complaint", "Not captured"),
        "onset_duration": values.get("onset_duration", "Not captured"),
        "associated_symptoms": {
            "breathlessness": values.get("breathlessness", "Not captured"),
            "sweating": values.get("sweating", "Not captured"),
        },
        "allergies": values.get("allergies", "Not captured"),
        "current_medications": values.get("current_medications", "Not captured"),
    }
    text = (
        f"Chief complaint: {content['chief_complaint']}. "
        f"Onset/duration: {content['onset_duration']}. "
        f"Breathlessness: {content['associated_symptoms']['breathlessness']}. "
        f"Sweating: {content['associated_symptoms']['sweating']}. "
        f"Allergies: {content['allergies']}. "
        f"Current medications: {content['current_medications']}."
    )
    return content, text


async def generate_summary(session: AsyncSession, encounter_id) -> Summary:
    content, template_text = await build_summary_content(session, encounter_id)
    generator = OpenAICompatibleSummaryGenerator(get_settings())
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
    )
    session.add(summary)
    return summary
