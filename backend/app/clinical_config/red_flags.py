"""Deterministic, evidence-linked safety rules.

Every rule here is a simple, auditable boolean condition over patient-confirmed
answers for one pathway. A triggered rule marks the encounter for urgent
*clinical review* — it never asserts a diagnosis. Each rule records exactly
which fact types triggered it so the triage/clinician view can show its
evidence.

New rules require clinical-owner review, wording, and positive/negative
synthetic fixtures before being enabled (task.md decision D-07).
"""

from collections.abc import Callable
from dataclasses import dataclass

from app.clinical_config.pathways import (
    ABDOMINAL_PAIN_PATHWAY_VERSION,
    CHEST_PATHWAY_VERSION,
    FEVER_PATHWAY_VERSION,
    HEADACHE_PATHWAY_VERSION,
)

RULE_SET_VERSION = "safety-rules-v2"

# Retained for backward compatibility with existing references (Postman docs,
# task.md) that name the original chest rule directly.
RULE_VERSION = RULE_SET_VERSION
CHEST_BREATHLESSNESS_RULE_ID = "chest-discomfort-with-breathlessness"
CHEST_BREATHLESSNESS_REASON = "Reported chest discomfort with breathlessness requires urgent clinical review."


def _yes(value: object) -> bool:
    return value in {True, "yes", "Yes"}


@dataclass(frozen=True)
class RedFlagRule:
    rule_id: str
    pathway_versions: tuple[str, ...]
    severity: str  # matches RedFlagSeverity value: urgent | high | moderate
    reason: str
    evidence_fact_types: tuple[str, ...]
    condition: Callable[[dict[str, object]], bool]


RED_FLAG_RULES: tuple[RedFlagRule, ...] = (
    RedFlagRule(
        rule_id=CHEST_BREATHLESSNESS_RULE_ID,
        pathway_versions=(CHEST_PATHWAY_VERSION,),
        severity="urgent",
        reason=CHEST_BREATHLESSNESS_REASON,
        evidence_fact_types=("chief_complaint", "breathlessness"),
        condition=lambda a: a.get("chief_complaint") == "chest_discomfort" and _yes(a.get("breathlessness")),
    ),
    RedFlagRule(
        rule_id="chest-discomfort-cardiac-pattern-radiation",
        pathway_versions=(CHEST_PATHWAY_VERSION,),
        severity="urgent",
        reason=(
            "Reported severe chest discomfort radiating to the arm, jaw, neck, or back "
            "requires urgent clinical review."
        ),
        evidence_fact_types=("chief_complaint", "chest_severity", "chest_radiation"),
        condition=lambda a: (
            a.get("chief_complaint") == "chest_discomfort"
            and a.get("chest_severity") in {"severe", "very_severe"}
            and a.get("chest_radiation")
            in {"left_arm_or_shoulder", "right_arm_or_shoulder", "jaw_neck_or_back", "more_than_one_area"}
        ),
    ),
    RedFlagRule(
        rule_id="chest-discomfort-with-syncope",
        pathway_versions=(CHEST_PATHWAY_VERSION,),
        severity="urgent",
        reason="Reported chest discomfort with dizziness or fainting requires urgent clinical review.",
        evidence_fact_types=("chief_complaint", "chest_dizziness_or_fainting"),
        condition=lambda a: (
            a.get("chief_complaint") == "chest_discomfort" and _yes(a.get("chest_dizziness_or_fainting"))
        ),
    ),
    RedFlagRule(
        rule_id="headache-severe-with-vision-change",
        pathway_versions=(HEADACHE_PATHWAY_VERSION,),
        severity="urgent",
        reason=(
            "Reported severe headache with a vision change requires urgent clinical review "
            "for a possible neurological cause."
        ),
        evidence_fact_types=("chief_complaint", "headache_severity", "vision_changes"),
        condition=lambda a: (
            a.get("chief_complaint") == "headache"
            and a.get("headache_severity") == "severe"
            and _yes(a.get("vision_changes"))
        ),
    ),
    RedFlagRule(
        rule_id="fever-high-temperature-with-rigors",
        pathway_versions=(FEVER_PATHWAY_VERSION,),
        severity="urgent",
        reason=(
            "Reported high measured temperature with chills/rigors requires urgent clinical review "
            "for a possible serious infection."
        ),
        evidence_fact_types=("chief_complaint", "measured_temperature", "chills"),
        condition=lambda a: (
            a.get("chief_complaint") == "fever"
            and a.get("measured_temperature") == "above_39_c"
            and _yes(a.get("chills"))
        ),
    ),
    RedFlagRule(
        rule_id="abdominal-pain-severe-with-vomiting",
        pathway_versions=(ABDOMINAL_PAIN_PATHWAY_VERSION,),
        severity="urgent",
        reason=(
            "Reported severe abdominal pain with vomiting requires urgent clinical review "
            "for a possible acute abdomen."
        ),
        evidence_fact_types=("chief_complaint", "abdominal_pain_severity", "nausea_or_vomiting"),
        condition=lambda a: (
            a.get("chief_complaint") == "abdominal_pain"
            and a.get("abdominal_pain_severity") == "severe"
            and _yes(a.get("nausea_or_vomiting"))
        ),
    ),
)


def rules_for_pathway(pathway_version: str) -> tuple[RedFlagRule, ...]:
    return tuple(rule for rule in RED_FLAG_RULES if pathway_version in rule.pathway_versions)
