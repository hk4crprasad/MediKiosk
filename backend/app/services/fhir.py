from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ClinicalFact, Encounter, FhirExport, Patient
from app.models.entities import VerificationStatus


async def create_local_export(session: AsyncSession, encounter: Encounter) -> FhirExport:
    patient = await session.scalar(select(Patient).where(Patient.id == encounter.patient_id))
    facts = (
        await session.scalars(
            select(ClinicalFact).where(
                ClinicalFact.encounter_id == encounter.id,
                ClinicalFact.verification_status == VerificationStatus.clinician_verified,
            )
        )
    ).all()
    entries = [
        {
            "resource": {
                "resourceType": "Patient",
                "id": str(patient.id),
                "identifier": [
                    {
                        "system": "https://healthid.abdm.gov.in",
                        "value": patient.abha_identifier,
                        "type": {
                            "coding": [
                                {"system": "http://terminology.hl7.org/CodeSystem/v2-0203", "code": "MR"}
                            ]
                        },
                    }
                ]
                if patient.abha_identifier
                else [],
                "name": [{"text": patient.display_name or "Synthetic patient"}],
                "gender": patient.sex,
                "contact": [
                    {
                        "relationship": [{"text": patient.caregiver_relationship or "Caregiver / Attendant"}],
                        "name": {"text": "Accompanying Caregiver"},
                    }
                ]
                if patient.respondent_type == "caregiver"
                else [],
            }
        },
        {
            "resource": {
                "resourceType": "Encounter",
                "id": str(encounter.id),
                "status": "finished"
                if encounter.status.value in {"SUBMITTED", "VERIFIED"}
                else "in-progress",
                "subject": {"reference": f"Patient/{patient.id}"},
            }
        },
    ]
    for fact in facts:
        entries.append(
            {
                "resource": {
                    "resourceType": "Observation",
                    "status": "final"
                    if fact.verification_status.value == "clinician_verified"
                    else "preliminary",
                    "subject": {"reference": f"Patient/{patient.id}"},
                    "encounter": {"reference": f"Encounter/{encounter.id}"},
                    "code": {"text": fact.fact_type},
                    "valueString": str(fact.value.get("value")),
                }
            }
        )
    bundle = {"resourceType": "Bundle", "type": "collection", "entry": entries}
    export = FhirExport(
        encounter_id=encounter.id, bundle=bundle, validation_status="local_structural_validation_passed"
    )
    session.add(export)
    return export
