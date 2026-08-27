from typing import Any

PATHWAY_VERSION = "chest-discomfort-v1"

QUESTIONS: list[dict[str, Any]] = [
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


def active_questions(answers: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for question in QUESTIONS:
        condition = question.get("when")
        if condition and any(answers.get(key) != value for key, value in condition.items()):
            continue
        result.append(question)
    return result
