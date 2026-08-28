from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import Principal, require_staff
from app.models import FhirExport
from app.schemas.fhir import FhirExportResponse
from app.services.access import get_encounter_or_404
from app.services.audit import write_audit
from app.services.fhir import create_local_export

router = APIRouter(prefix="/encounters/{encounter_id}/fhir/exports", tags=["FHIR"])


@router.post("", response_model=FhirExportResponse, status_code=status.HTTP_201_CREATED)
async def create_export(
    encounter_id: UUID,
    request: Request,
    principal: Principal = Depends(require_staff("admin", "physician")),
    session: AsyncSession = Depends(get_session),
) -> FhirExportResponse:
    encounter = await get_encounter_or_404(session, encounter_id)
    export = await create_local_export(session, encounter)
    await write_audit(
        session, "fhir.exported", actor_id=principal.subject, encounter_id=encounter_id, request=request
    )
    await session.commit()
    await session.refresh(export)
    return FhirExportResponse.model_validate(export)


@router.get("/{export_id}", response_model=FhirExportResponse)
async def get_export(
    encounter_id: UUID,
    export_id: UUID,
    _: Principal = Depends(require_staff("admin", "triage", "physician")),
    session: AsyncSession = Depends(get_session),
) -> FhirExportResponse:
    export = await session.get(FhirExport, export_id)
    if export is None or export.encounter_id != encounter_id:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="FHIR export not found")
    return FhirExportResponse.model_validate(export)
