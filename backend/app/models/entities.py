from datetime import date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON, Uuid

from app.core.database import Base

JsonType = JSON().with_variant(JSONB, "postgresql")


class UserRole(StrEnum):
    admin = "admin"
    triage = "triage"
    physician = "physician"


class EncounterStatus(StrEnum):
    draft = "DRAFT"
    in_progress = "IN_PROGRESS"
    urgent_review = "URGENT_REVIEW"
    submitted = "SUBMITTED"
    in_review = "IN_REVIEW"
    verified = "VERIFIED"
    cancelled = "CANCELLED"


class VerificationStatus(StrEnum):
    unverified = "unverified"
    patient_confirmed = "patient_confirmed"
    clinician_verified = "clinician_verified"
    rejected = "rejected"


class RedFlagSeverity(StrEnum):
    urgent = "urgent"
    high = "high"
    moderate = "moderate"


class DocumentStatus(StrEnum):
    uploaded = "UPLOADED"
    processing = "PROCESSING"
    processed = "PROCESSED"
    failed = "FAILED"


class SummaryStatus(StrEnum):
    draft = "DRAFT"
    accepted = "ACCEPTED"
    rejected = "REJECTED"


class TimestampedModel:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class User(TimestampedModel, Base):
    __tablename__ = "users"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    token_id: Mapped[UUID] = mapped_column(Uuid, unique=True, index=True, nullable=False)
    # Not a FK: this table records revocations for both staff (`users.id`) and patient
    # (`patient_accounts.id`) tokens. get_principal only ever queries by token_id, never
    # joins through actor_id, so referential integrity to one specific table isn't needed.
    actor_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Patient(TimestampedModel, Base):
    __tablename__ = "patients"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    display_name: Mapped[str | None] = mapped_column(String(200))
    birth_year: Mapped[int | None] = mapped_column(Integer)
    sex: Mapped[str | None] = mapped_column(String(32))
    preferred_language: Mapped[str] = mapped_column(String(16), default="en", nullable=False)
    abha_identifier: Mapped[str | None] = mapped_column(String(64), unique=True)
    respondent_type: Mapped[str] = mapped_column(String(32), default="patient", nullable=False)
    caregiver_relationship: Mapped[str | None] = mapped_column(String(64))


class Encounter(TimestampedModel, Base):
    __tablename__ = "encounters"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    status: Mapped[EncounterStatus] = mapped_column(
        Enum(EncounterStatus), default=EncounterStatus.draft, index=True
    )
    mode: Mapped[str] = mapped_column(String(32), default="kiosk", nullable=False)
    pathway_version: Mapped[str] = mapped_column(String(64), default="chest-discomfort-v1", nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    physician_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Consent(TimestampedModel, Base):
    __tablename__ = "consents"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    encounter_id: Mapped[UUID] = mapped_column(ForeignKey("encounters.id"), index=True)
    consent_type: Mapped[str] = mapped_column(String(64))
    version: Mapped[str] = mapped_column(String(64))
    language: Mapped[str] = mapped_column(String(16))
    granted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (UniqueConstraint("encounter_id", "consent_type", "version", name="uq_consent_version"),)


class PatientResponse(TimestampedModel, Base):
    __tablename__ = "patient_responses"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    encounter_id: Mapped[UUID] = mapped_column(ForeignKey("encounters.id"), index=True)
    question_key: Mapped[str] = mapped_column(String(128), index=True)
    input_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    raw_text: Mapped[str | None] = mapped_column(Text)
    normalized_value: Mapped[dict] = mapped_column(JsonType, default=dict, nullable=False)
    language: Mapped[str] = mapped_column(String(16), nullable=False)


class ClinicalFact(TimestampedModel, Base):
    __tablename__ = "clinical_facts"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    encounter_id: Mapped[UUID] = mapped_column(ForeignKey("encounters.id"), index=True)
    fact_type: Mapped[str] = mapped_column(String(128), index=True)
    value: Mapped[dict] = mapped_column(JsonType, nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[UUID | None] = mapped_column(Uuid)
    source_excerpt: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column()
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus), default=VerificationStatus.unverified, nullable=False
    )


class RedFlag(TimestampedModel, Base):
    __tablename__ = "red_flags"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    encounter_id: Mapped[UUID] = mapped_column(ForeignKey("encounters.id"), index=True)
    rule_id: Mapped[str] = mapped_column(String(128))
    rule_version: Mapped[str] = mapped_column(String(64))
    severity: Mapped[RedFlagSeverity] = mapped_column(Enum(RedFlagSeverity), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_fact_ids: Mapped[list] = mapped_column(JsonType, default=list, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    acknowledged_by: Mapped[UUID | None] = mapped_column(Uuid)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Document(TimestampedModel, Base):
    __tablename__ = "documents"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    encounter_id: Mapped[UUID] = mapped_column(ForeignKey("encounters.id"), index=True)
    document_type: Mapped[str] = mapped_column(String(64), default="other", nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    processing_status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus), default=DocumentStatus.uploaded, nullable=False
    )


class AssistiveArtifact(Base):
    __tablename__ = "assistive_artifacts"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    encounter_id: Mapped[UUID] = mapped_column(ForeignKey("encounters.id"), index=True)
    document_id: Mapped[UUID | None] = mapped_column(ForeignKey("documents.id"), index=True)
    artifact_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    language: Mapped[str | None] = mapped_column(String(16))
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    structured_data: Mapped[dict] = mapped_column(JsonType, default=dict, nullable=False)
    confidence: Mapped[float | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class QuestionAudioPrompt(TimestampedModel, Base):
    __tablename__ = "question_audio_prompts"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    question_key: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    language: Mapped[str] = mapped_column(String(16), default="en", nullable=False)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), default="audio/wav", nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)


class Summary(TimestampedModel, Base):
    __tablename__ = "summaries"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    encounter_id: Mapped[UUID] = mapped_column(ForeignKey("encounters.id"), index=True)
    content: Mapped[dict] = mapped_column(JsonType, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="template", nullable=False)
    prompt_version: Mapped[str | None] = mapped_column(String(64))
    prompt_metadata: Mapped[dict] = mapped_column(JsonType, default=dict, nullable=False)
    status: Mapped[SummaryStatus] = mapped_column(
        Enum(SummaryStatus), default=SummaryStatus.draft, nullable=False
    )


class PhysicianRevision(Base):
    __tablename__ = "physician_revisions"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    encounter_id: Mapped[UUID] = mapped_column(ForeignKey("encounters.id"), index=True)
    summary_id: Mapped[UUID] = mapped_column(ForeignKey("summaries.id"), index=True)
    field_path: Mapped[str] = mapped_column(String(256), default="/text", nullable=False)
    old_value: Mapped[str] = mapped_column(Text, nullable=False)
    new_value: Mapped[str] = mapped_column(Text, nullable=False)
    doctor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    actor_id: Mapped[UUID | None] = mapped_column(Uuid, index=True)
    encounter_id: Mapped[UUID | None] = mapped_column(Uuid, index=True)
    event_type: Mapped[str] = mapped_column(String(128), index=True)
    request_id: Mapped[str | None] = mapped_column(String(64))
    metadata_json: Mapped[dict] = mapped_column(JsonType, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class FhirExport(Base):
    __tablename__ = "fhir_exports"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    encounter_id: Mapped[UUID] = mapped_column(ForeignKey("encounters.id"), index=True)
    bundle: Mapped[dict] = mapped_column(JsonType, nullable=False)
    validation_status: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# --- Patient portal -------------------------------------------------------
# A parallel, self-service subsystem: a patient registers once and builds a
# personal archive of their own documents/visit history across time. This is
# deliberately separate from Encounter/Document/AssistiveArtifact (the
# consent-gated, pathway-driven kiosk clinical intake) — a registered account
# never creates or joins a kiosk Encounter.


class PatientAccount(TimestampedModel, Base):
    __tablename__ = "patient_accounts"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(200))
    birth_year: Mapped[int | None] = mapped_column(Integer)
    sex: Mapped[str | None] = mapped_column(String(32))
    abha_identifier: Mapped[str | None] = mapped_column(String(64), unique=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PatientRecord(TimestampedModel, Base):
    """One report/document a registered patient has uploaded to their own archive."""

    __tablename__ = "patient_records"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    patient_account_id: Mapped[UUID] = mapped_column(
        ForeignKey("patient_accounts.id"), index=True, nullable=False
    )
    visit_date: Mapped[date | None] = mapped_column(Date)
    hospital_or_clinic: Mapped[str | None] = mapped_column(String(200))
    visit_reason: Mapped[str | None] = mapped_column(String(500))
    document_type: Mapped[str] = mapped_column(String(64), default="other", nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    processing_status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus), default=DocumentStatus.uploaded, nullable=False
    )


class PatientRecordExtraction(Base):
    """OCR/vision extraction for one PatientRecord. Mirrors AssistiveArtifact's shape,
    scoped to a patient record instead of an encounter. Always unverified evidence —
    there is no clinician-review/promotion workflow for the patient's own archive."""

    __tablename__ = "patient_record_extractions"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    patient_record_id: Mapped[UUID] = mapped_column(
        ForeignKey("patient_records.id"), index=True, nullable=False
    )
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    structured_data: Mapped[dict] = mapped_column(JsonType, default=dict, nullable=False)
    confidence: Mapped[float | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PatientHistorySummary(TimestampedModel, Base):
    """A regenerable, read-only AI synthesis across all of one patient's records.
    Never a diagnosis; always cites only the patient's own supplied records/extractions."""

    __tablename__ = "patient_history_summaries"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    patient_account_id: Mapped[UUID] = mapped_column(
        ForeignKey("patient_accounts.id"), index=True, nullable=False
    )
    content: Mapped[dict] = mapped_column(JsonType, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="template", nullable=False)
    prompt_version: Mapped[str | None] = mapped_column(String(64))
    prompt_metadata: Mapped[dict] = mapped_column(JsonType, default=dict, nullable=False)
