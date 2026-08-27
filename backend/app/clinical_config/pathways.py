from typing import Any

CHEST_PATHWAY_VERSION = "chest-discomfort-v1"
FEVER_PATHWAY_VERSION = "fever-v1"
HEADACHE_PATHWAY_VERSION = "headache-v1"
ABDOMINAL_PAIN_PATHWAY_VERSION = "abdominal-pain-v1"
AYUSH_PATHWAY_VERSION = "ayush-dashavidha-v1"

CHEST_QUESTIONS: list[dict[str, Any]] = [
    {
        "key": "chief_complaint",
        "section": "presenting_complaint",
        "prompt": "What is the main problem today?",
        "input_type": "single_choice",
        "required": True,
        "choices": ["chest_discomfort", "fever", "headache", "abdominal_pain", "other"],
    },
    {
        "key": "onset_duration",
        "section": "presenting_complaint",
        "prompt": "When did this problem start and how long has it been present?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
    {
        "key": "breathlessness",
        "section": "associated_symptoms",
        "prompt": "Are you experiencing breathlessness?",
        "input_type": "boolean",
        "required": True,
        "choices": ["yes", "no"],
        "when": {"chief_complaint": "chest_discomfort"},
    },
    {
        "key": "sweating",
        "section": "associated_symptoms",
        "prompt": "Are you having unusual sweating with the discomfort?",
        "input_type": "boolean",
        "required": False,
        "choices": ["yes", "no"],
        "when": {"chief_complaint": "chest_discomfort"},
    },
    {
        "key": "allergies",
        "section": "history",
        "prompt": "Do you have any known allergies?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
    {
        "key": "current_medications",
        "section": "history",
        "prompt": "What medicines are you currently taking?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
]


FEVER_QUESTIONS: list[dict[str, Any]] = [
    {
        "key": "chief_complaint",
        "section": "presenting_complaint",
        "prompt": "Please confirm the main problem today.",
        "input_type": "single_choice",
        "required": True,
        "choices": ["fever"],
    },
    {
        "key": "onset_duration",
        "section": "presenting_complaint",
        "prompt": "When did the fever start and how long has it been present?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
    {
        "key": "measured_temperature",
        "section": "presenting_complaint",
        "prompt": "What was the highest temperature measured, if known? Include the unit.",
        "input_type": "free_text",
        "required": False,
        "choices": [],
    },
    {
        "key": "chills",
        "section": "associated_symptoms",
        "prompt": "Have you had chills or shivering?",
        "input_type": "boolean",
        "required": True,
        "choices": ["yes", "no"],
    },
    {
        "key": "fever_associated_symptoms",
        "section": "associated_symptoms",
        "prompt": "What other symptoms have you noticed, if any?",
        "input_type": "free_text",
        "required": False,
        "choices": [],
    },
    {
        "key": "allergies",
        "section": "history",
        "prompt": "Do you have any known allergies?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
    {
        "key": "current_medications",
        "section": "history",
        "prompt": "What medicines are you currently taking?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
]


HEADACHE_QUESTIONS: list[dict[str, Any]] = [
    {
        "key": "chief_complaint",
        "section": "presenting_complaint",
        "prompt": "Please confirm the main problem today.",
        "input_type": "single_choice",
        "required": True,
        "choices": ["headache"],
    },
    {
        "key": "onset_duration",
        "section": "presenting_complaint",
        "prompt": "When did the headache start and how long has it been present?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
    {
        "key": "headache_location",
        "section": "presenting_complaint",
        "prompt": "Where is the headache located?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
    {
        "key": "headache_severity",
        "section": "presenting_complaint",
        "prompt": "How would you describe the headache severity?",
        "input_type": "single_choice",
        "required": True,
        "choices": ["mild", "moderate", "severe", "not_sure"],
    },
    {
        "key": "vision_changes",
        "section": "associated_symptoms",
        "prompt": "Have you noticed any changes in vision?",
        "input_type": "boolean",
        "required": True,
        "choices": ["yes", "no"],
    },
    {
        "key": "headache_associated_symptoms",
        "section": "associated_symptoms",
        "prompt": "What other symptoms have you noticed, if any?",
        "input_type": "free_text",
        "required": False,
        "choices": [],
    },
    {
        "key": "allergies",
        "section": "history",
        "prompt": "Do you have any known allergies?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
    {
        "key": "current_medications",
        "section": "history",
        "prompt": "What medicines are you currently taking?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
]


ABDOMINAL_PAIN_QUESTIONS: list[dict[str, Any]] = [
    {
        "key": "chief_complaint",
        "section": "presenting_complaint",
        "prompt": "Please confirm the main problem today.",
        "input_type": "single_choice",
        "required": True,
        "choices": ["abdominal_pain"],
    },
    {
        "key": "onset_duration",
        "section": "presenting_complaint",
        "prompt": "When did the abdominal pain start and how long has it been present?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
    {
        "key": "abdominal_pain_location",
        "section": "presenting_complaint",
        "prompt": "Where is the pain located?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
    {
        "key": "abdominal_pain_severity",
        "section": "presenting_complaint",
        "prompt": "How would you describe the pain severity?",
        "input_type": "single_choice",
        "required": True,
        "choices": ["mild", "moderate", "severe", "not_sure"],
    },
    {
        "key": "nausea_or_vomiting",
        "section": "associated_symptoms",
        "prompt": "Have you had nausea or vomiting?",
        "input_type": "boolean",
        "required": True,
        "choices": ["yes", "no"],
    },
    {
        "key": "bowel_or_urinary_changes",
        "section": "associated_symptoms",
        "prompt": "Have you noticed any bowel or urinary changes?",
        "input_type": "free_text",
        "required": False,
        "choices": [],
    },
    {
        "key": "allergies",
        "section": "history",
        "prompt": "Do you have any known allergies?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
    {
        "key": "current_medications",
        "section": "history",
        "prompt": "What medicines are you currently taking?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
]


AYUSH_QUESTIONS: list[dict[str, Any]] = [
    {
        "key": "ayush_prakriti",
        "section": "dashavidha_pariksha",
        "prompt": "How would you describe your usual body constitution, if known?",
        "input_type": "free_text",
        "required": False,
        "choices": [],
    },
    {
        "key": "ayush_vikriti",
        "section": "dashavidha_pariksha",
        "prompt": "What change from your usual state are you experiencing today?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
    {
        "key": "ayush_sara",
        "section": "dashavidha_pariksha",
        "prompt": "Please describe your usual tissue strength or vitality, if known.",
        "input_type": "free_text",
        "required": False,
        "choices": [],
    },
    {
        "key": "ayush_samhanana",
        "section": "dashavidha_pariksha",
        "prompt": "How would you describe your body build or physical frame?",
        "input_type": "free_text",
        "required": False,
        "choices": [],
    },
    {
        "key": "ayush_pramana",
        "section": "dashavidha_pariksha",
        "prompt": "Please share relevant body measurements or proportions, if you wish.",
        "input_type": "free_text",
        "required": False,
        "choices": [],
    },
    {
        "key": "ayush_satmya",
        "section": "dashavidha_pariksha",
        "prompt": "Which foods, routines, or environments usually suit you well?",
        "input_type": "free_text",
        "required": False,
        "choices": [],
    },
    {
        "key": "ayush_sattva",
        "section": "dashavidha_pariksha",
        "prompt": "How would you describe your usual mental resilience or response to stress?",
        "input_type": "free_text",
        "required": False,
        "choices": [],
    },
    {
        "key": "ayush_ahara_shakti",
        "section": "dashavidha_pariksha",
        "prompt": "How is your usual appetite and capacity for food?",
        "input_type": "free_text",
        "required": False,
        "choices": [],
    },
    {
        "key": "ayush_vyayama_shakti",
        "section": "dashavidha_pariksha",
        "prompt": "How much physical activity or exercise can you usually tolerate?",
        "input_type": "free_text",
        "required": False,
        "choices": [],
    },
    {
        "key": "ayush_vaya",
        "section": "dashavidha_pariksha",
        "prompt": "Which life stage best describes you?",
        "input_type": "single_choice",
        "required": True,
        "choices": ["child", "young_adult", "adult", "older_adult", "prefer_not_to_say"],
    },
    {
        "key": "ayush_ahara",
        "section": "lifestyle_context",
        "prompt": "Please describe your usual diet and recent dietary changes.",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
    {
        "key": "ayush_vihara",
        "section": "lifestyle_context",
        "prompt": "Please describe your sleep, daily routine, and activity pattern.",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
    {
        "key": "ayush_agni",
        "section": "lifestyle_context",
        "prompt": "How would you describe your digestion currently?",
        "input_type": "single_choice",
        "required": True,
        "choices": ["regular", "reduced", "irregular", "increased", "not_sure"],
    },
    {
        "key": "ayush_koshtha",
        "section": "lifestyle_context",
        "prompt": "How would you describe your usual bowel pattern?",
        "input_type": "single_choice",
        "required": True,
        "choices": ["regular", "constipation_tendency", "loose_stools_tendency", "variable", "not_sure"],
    },
    {
        "key": "ayush_nidana",
        "section": "lifestyle_context",
        "prompt": "What factors do you think may be related to your current concern?",
        "input_type": "free_text",
        "required": True,
        "choices": [],
    },
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
    result = []
    for question in questions:
        condition = question.get("when")
        if condition and any(answers.get(key) != value for key, value in condition.items()):
            continue
        result.append(question)
    return result
