from typing import Any

CHEST_PATHWAY_VERSION = "chest-discomfort-v1"
FEVER_PATHWAY_VERSION = "fever-v1"
HEADACHE_PATHWAY_VERSION = "headache-v1"
ABDOMINAL_PAIN_PATHWAY_VERSION = "abdominal-pain-v1"
AYUSH_PATHWAY_VERSION = "ayush-dashavidha-v1"


def choice(
    key: str, section: str, prompt: str, choices: list[str], *, required: bool = True, when: dict[str, str] | None = None
) -> dict[str, Any]:
    """A tablet-kiosk question has one controlled, touch-selectable answer only."""
    question: dict[str, Any] = {
        "key": key,
        "section": section,
        "prompt": prompt,
        "input_type": "single_choice",
        "required": required,
        "choices": choices,
    }
    if when:
        question["when"] = when
    return question


ONSET_CHOICES = ["started_today", "1_to_2_days", "3_to_7_days", "more_than_a_week", "not_sure"]
ALLERGY_CHOICES = ["no_known_allergies", "yes_known_allergies", "not_sure", "prefer_not_to_say"]
MEDICATION_CHOICES = ["no_current_medicines", "one_or_more_medicines", "not_sure", "prefer_not_to_say"]
YES_NO_CHOICES = ["yes", "no", "not_sure"]

CHEST_QUESTIONS = [
    choice("chief_complaint", "presenting_complaint", "What is the main problem today?", ["chest_discomfort", "fever", "headache", "abdominal_pain", "other"]),
    choice("onset_duration", "presenting_complaint", "When did this problem start?", ONSET_CHOICES),
    choice("breathlessness", "associated_symptoms", "Are you experiencing breathlessness?", YES_NO_CHOICES, when={"chief_complaint": "chest_discomfort"}),
    choice("sweating", "associated_symptoms", "Are you having unusual sweating with the discomfort?", YES_NO_CHOICES, required=False, when={"chief_complaint": "chest_discomfort"}),
    choice("allergies", "history", "Do you have any known allergies?", ALLERGY_CHOICES),
    choice("current_medications", "history", "Are you currently taking any medicines?", MEDICATION_CHOICES),
]

FEVER_QUESTIONS = [
    choice("chief_complaint", "presenting_complaint", "Please confirm the main problem today.", ["fever"]),
    choice("onset_duration", "presenting_complaint", "When did the fever start?", ONSET_CHOICES),
    choice("measured_temperature", "presenting_complaint", "What was the highest temperature measured, if known?", ["not_measured", "below_38_c", "38_to_39_c", "above_39_c", "not_sure"], required=False),
    choice("chills", "associated_symptoms", "Have you had chills or shivering?", YES_NO_CHOICES),
    choice("fever_associated_symptoms", "associated_symptoms", "Which other symptom is most noticeable?", ["none", "cough_or_cold_symptoms", "body_aches", "nausea_or_vomiting", "other_symptom", "not_sure"], required=False),
    choice("allergies", "history", "Do you have any known allergies?", ALLERGY_CHOICES),
    choice("current_medications", "history", "Are you currently taking any medicines?", MEDICATION_CHOICES),
]

HEADACHE_QUESTIONS = [
    choice("chief_complaint", "presenting_complaint", "Please confirm the main problem today.", ["headache"]),
    choice("onset_duration", "presenting_complaint", "When did the headache start?", ONSET_CHOICES),
    choice("headache_location", "presenting_complaint", "Where is the headache located?", ["front", "back", "one_side", "both_sides", "all_over", "not_sure"]),
    choice("headache_severity", "presenting_complaint", "How severe is the headache?", ["mild", "moderate", "severe", "not_sure"]),
    choice("vision_changes", "associated_symptoms", "Have you noticed any changes in vision?", YES_NO_CHOICES),
    choice("headache_associated_symptoms", "associated_symptoms", "Which other symptom is most noticeable?", ["none", "nausea_or_vomiting", "light_or_sound_sensitivity", "neck_discomfort", "other_symptom", "not_sure"], required=False),
    choice("allergies", "history", "Do you have any known allergies?", ALLERGY_CHOICES),
    choice("current_medications", "history", "Are you currently taking any medicines?", MEDICATION_CHOICES),
]

ABDOMINAL_PAIN_QUESTIONS = [
    choice("chief_complaint", "presenting_complaint", "Please confirm the main problem today.", ["abdominal_pain"]),
    choice("onset_duration", "presenting_complaint", "When did the abdominal pain start?", ONSET_CHOICES),
    choice("abdominal_pain_location", "presenting_complaint", "Where is the pain located?", ["upper_abdomen", "lower_abdomen", "right_side", "left_side", "all_over", "not_sure"]),
    choice("abdominal_pain_severity", "presenting_complaint", "How severe is the pain?", ["mild", "moderate", "severe", "not_sure"]),
    choice("nausea_or_vomiting", "associated_symptoms", "Have you had nausea or vomiting?", YES_NO_CHOICES),
    choice("bowel_or_urinary_changes", "associated_symptoms", "Have you noticed a bowel or urinary change?", ["no_change", "bowel_change", "urinary_change", "both", "not_sure"], required=False),
    choice("allergies", "history", "Do you have any known allergies?", ALLERGY_CHOICES),
    choice("current_medications", "history", "Are you currently taking any medicines?", MEDICATION_CHOICES),
]

AYUSH_QUESTIONS = [
    choice("ayush_prakriti", "dashavidha_pariksha", "How would you describe your usual body constitution, if known?", ["vata", "pitta", "kapha", "mixed", "not_known", "prefer_not_to_say"], required=False),
    choice("ayush_vikriti", "dashavidha_pariksha", "What change from your usual state are you experiencing today?", ["pain_or_discomfort", "fever_or_warmth", "digestive_change", "sleep_or_energy_change", "other_change", "not_sure"]),
    choice("ayush_sara", "dashavidha_pariksha", "How would you describe your usual strength or vitality?", ["low", "moderate", "good", "not_sure", "prefer_not_to_say"], required=False),
    choice("ayush_samhanana", "dashavidha_pariksha", "How would you describe your body build or physical frame?", ["slender", "medium", "broad", "not_sure", "prefer_not_to_say"], required=False),
    choice("ayush_pramana", "dashavidha_pariksha", "Would you like to share body measurement information today?", ["yes", "no", "not_sure", "prefer_not_to_say"], required=False),
    choice("ayush_satmya", "dashavidha_pariksha", "What usually suits you best?", ["warm_food_or_routine", "cool_food_or_routine", "regular_routine", "varies", "not_sure", "prefer_not_to_say"], required=False),
    choice("ayush_sattva", "dashavidha_pariksha", "How would you describe your usual response to stress?", ["usually_calm", "sometimes_stressed", "often_stressed", "not_sure", "prefer_not_to_say"], required=False),
    choice("ayush_ahara_shakti", "dashavidha_pariksha", "How is your usual appetite?", ["reduced", "regular", "increased", "variable", "not_sure", "prefer_not_to_say"], required=False),
    choice("ayush_vyayama_shakti", "dashavidha_pariksha", "How much activity can you usually tolerate?", ["low", "moderate", "high", "variable", "not_sure", "prefer_not_to_say"], required=False),
    choice("ayush_vaya", "dashavidha_pariksha", "Which life stage best describes you?", ["child", "young_adult", "adult", "older_adult", "prefer_not_to_say"]),
    choice("ayush_ahara", "lifestyle_context", "How would you describe your usual diet?", ["mostly_home_cooked", "mixed_diet", "frequent_outside_food", "restricted_diet", "not_sure", "prefer_not_to_say"]),
    choice("ayush_vihara", "lifestyle_context", "How would you describe your usual daily routine?", ["regular", "irregular", "poor_sleep", "physically_demanding", "not_sure", "prefer_not_to_say"]),
    choice("ayush_agni", "lifestyle_context", "How would you describe your digestion currently?", ["regular", "reduced", "irregular", "increased", "not_sure"]),
    choice("ayush_koshtha", "lifestyle_context", "How would you describe your usual bowel pattern?", ["regular", "constipation_tendency", "loose_stools_tendency", "variable", "not_sure"]),
    choice("ayush_nidana", "lifestyle_context", "What may be related to your current concern?", ["food_or_diet", "sleep_or_routine", "stress", "weather_or_environment", "not_sure", "prefer_not_to_say"]),
]

PATHWAYS: dict[str, list[dict[str, Any]]] = {
    CHEST_PATHWAY_VERSION: CHEST_QUESTIONS,
    FEVER_PATHWAY_VERSION: FEVER_QUESTIONS,
    HEADACHE_PATHWAY_VERSION: HEADACHE_QUESTIONS,
    ABDOMINAL_PAIN_PATHWAY_VERSION: ABDOMINAL_PAIN_QUESTIONS,
    AYUSH_PATHWAY_VERSION: AYUSH_QUESTIONS,
}


def is_supported_pathway(pathway_version: str) -> bool:
    return pathway_version in PATHWAYS


def supported_pathway_versions() -> list[str]:
    return list(PATHWAYS)


def active_questions(pathway_version: str, answers: dict[str, Any]) -> list[dict[str, Any]]:
    questions = PATHWAYS.get(pathway_version)
    if questions is None:
        return []
    return [
        question
        for question in questions
        if not (condition := question.get("when")) or all(answers.get(key) == value for key, value in condition.items())
    ]
