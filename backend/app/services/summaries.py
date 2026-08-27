from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ClinicalFact, Summary


async def generate_template_summary(session: AsyncSession, encounter_id) -> Summary:
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
    summary = Summary(encounter_id=encounter_id, content=content, text=text, source="template")
    session.add(summary)
    return summary
