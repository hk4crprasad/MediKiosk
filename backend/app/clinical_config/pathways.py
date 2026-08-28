from typing import Any

CHEST_PATHWAY_VERSION = "chest-discomfort-v1"
FEVER_PATHWAY_VERSION = "fever-v1"
HEADACHE_PATHWAY_VERSION = "headache-v1"
ABDOMINAL_PAIN_PATHWAY_VERSION = "abdominal-pain-v1"
AYUSH_PATHWAY_VERSION = "ayush-dashavidha-v1"


def choice(
    key: str,
    section: str,
    prompt: str,
    choices: list[str],
    *,
    required: bool = True,
    when: dict[str, str] | None = None,
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
    choice(
        "chief_complaint",
        "presenting_complaint",
        "Please confirm the main problem today.",
        ["chest_discomfort"],
    ),
    choice(
        "chest_onset",
        "hpi",
        "When did the chest discomfort begin?",
        ["within_last_hour", "today", "1_to_7_days", "more_than_a_week", "not_sure"],
    ),
    choice(
        "chest_character",
        "hpi",
        "Which description fits the chest discomfort best?",
        ["pressure_or_heaviness", "tightness", "burning", "sharp_or_stabbing", "dull_ache", "not_sure"],
    ),
    choice(
        "chest_radiation",
        "hpi",
        "Does the discomfort spread anywhere?",
        [
            "does_not_spread",
            "left_arm_or_shoulder",
            "right_arm_or_shoulder",
            "jaw_neck_or_back",
            "more_than_one_area",
            "not_sure",
        ],
    ),
    choice(
        "chest_severity",
        "hpi",
        "How severe is the chest discomfort right now?",
        ["mild", "moderate", "severe", "very_severe", "not_sure"],
    ),
    choice(
        "chest_timing",
        "hpi",
        "How does the chest discomfort behave?",
        ["constant", "comes_and_goes", "with_activity", "at_rest", "wakes_from_sleep", "not_sure"],
    ),
    choice(
        "breathlessness",
        "associated_symptoms",
        "Are you experiencing breathlessness?",
        YES_NO_CHOICES,
        when={"chief_complaint": "chest_discomfort"},
    ),
    choice(
        "sweating",
        "associated_symptoms",
        "Are you having unusual sweating with the discomfort?",
        YES_NO_CHOICES,
        required=False,
        when={"chief_complaint": "chest_discomfort"},
    ),
    choice(
        "chest_nausea_or_vomiting",
        "associated_symptoms",
        "Are you having nausea or vomiting with the discomfort?",
        YES_NO_CHOICES,
        required=False,
        when={"chief_complaint": "chest_discomfort"},
    ),
    choice(
        "chest_dizziness_or_fainting",
        "associated_symptoms",
        "Are you feeling dizzy or have you fainted?",
        YES_NO_CHOICES,
        required=False,
        when={"chief_complaint": "chest_discomfort"},
    ),
    choice("allergies", "history", "Do you have any known allergies?", ALLERGY_CHOICES),
    choice("current_medications", "history", "Are you currently taking any medicines?", MEDICATION_CHOICES),
]

FEVER_QUESTIONS = [
    choice("chief_complaint", "presenting_complaint", "Please confirm the main problem today.", ["fever"]),
    choice("onset_duration", "presenting_complaint", "When did the fever start?", ONSET_CHOICES),
    choice(
        "measured_temperature",
        "presenting_complaint",
        "What was the highest temperature measured, if known?",
        ["not_measured", "below_38_c", "38_to_39_c", "above_39_c", "not_sure"],
        required=False,
    ),
    choice("chills", "associated_symptoms", "Have you had chills or shivering?", YES_NO_CHOICES),
    choice(
        "fever_associated_symptoms",
        "associated_symptoms",
        "Which other symptom is most noticeable?",
        ["none", "cough_or_cold_symptoms", "body_aches", "nausea_or_vomiting", "other_symptom", "not_sure"],
        required=False,
    ),
    choice("allergies", "history", "Do you have any known allergies?", ALLERGY_CHOICES),
    choice("current_medications", "history", "Are you currently taking any medicines?", MEDICATION_CHOICES),
]

HEADACHE_QUESTIONS = [
    choice("chief_complaint", "presenting_complaint", "Please confirm the main problem today.", ["headache"]),
    choice("onset_duration", "presenting_complaint", "When did the headache start?", ONSET_CHOICES),
    choice(
        "headache_location",
        "presenting_complaint",
        "Where is the headache located?",
        ["front", "back", "one_side", "both_sides", "all_over", "not_sure"],
    ),
    choice(
        "headache_severity",
        "presenting_complaint",
        "How severe is the headache?",
        ["mild", "moderate", "severe", "not_sure"],
    ),
    choice(
        "vision_changes", "associated_symptoms", "Have you noticed any changes in vision?", YES_NO_CHOICES
    ),
    choice(
        "headache_associated_symptoms",
        "associated_symptoms",
        "Which other symptom is most noticeable?",
        [
            "none",
            "nausea_or_vomiting",
            "light_or_sound_sensitivity",
            "neck_discomfort",
            "other_symptom",
            "not_sure",
        ],
        required=False,
    ),
    choice("allergies", "history", "Do you have any known allergies?", ALLERGY_CHOICES),
    choice("current_medications", "history", "Are you currently taking any medicines?", MEDICATION_CHOICES),
]

ABDOMINAL_PAIN_QUESTIONS = [
    choice(
        "chief_complaint",
        "presenting_complaint",
        "Please confirm the main problem today.",
        ["abdominal_pain"],
    ),
    choice("onset_duration", "presenting_complaint", "When did the abdominal pain start?", ONSET_CHOICES),
    choice(
        "abdominal_pain_location",
        "presenting_complaint",
        "Where is the pain located?",
        ["upper_abdomen", "lower_abdomen", "right_side", "left_side", "all_over", "not_sure"],
    ),
    choice(
        "abdominal_pain_severity",
        "presenting_complaint",
        "How severe is the pain?",
        ["mild", "moderate", "severe", "not_sure"],
    ),
    choice("nausea_or_vomiting", "associated_symptoms", "Have you had nausea or vomiting?", YES_NO_CHOICES),
    choice(
        "bowel_or_urinary_changes",
        "associated_symptoms",
        "Have you noticed a bowel or urinary change?",
        ["no_change", "bowel_change", "urinary_change", "both", "not_sure"],
        required=False,
    ),
    choice("allergies", "history", "Do you have any known allergies?", ALLERGY_CHOICES),
    choice("current_medications", "history", "Are you currently taking any medicines?", MEDICATION_CHOICES),
]

AYUSH_QUESTIONS = [
    choice(
        "ayush_prakriti",
        "dashavidha_pariksha",
        "How would you describe your usual body constitution, if known?",
        ["vata", "pitta", "kapha", "mixed", "not_known", "prefer_not_to_say"],
        required=False,
    ),
    choice(
        "ayush_vikriti",
        "dashavidha_pariksha",
        "What change from your usual state are you experiencing today?",
        [
            "pain_or_discomfort",
            "fever_or_warmth",
            "digestive_change",
            "sleep_or_energy_change",
            "other_change",
            "not_sure",
        ],
    ),
    choice(
        "ayush_sara",
        "dashavidha_pariksha",
        "How would you describe your usual strength or vitality?",
        ["low", "moderate", "good", "not_sure", "prefer_not_to_say"],
        required=False,
    ),
    choice(
        "ayush_samhanana",
        "dashavidha_pariksha",
        "How would you describe your body build or physical frame?",
        ["slender", "medium", "broad", "not_sure", "prefer_not_to_say"],
        required=False,
    ),
    choice(
        "ayush_pramana",
        "dashavidha_pariksha",
        "Would you like to share body measurement information today?",
        ["yes", "no", "not_sure", "prefer_not_to_say"],
        required=False,
    ),
    choice(
        "ayush_satmya",
        "dashavidha_pariksha",
        "What usually suits you best?",
        [
            "warm_food_or_routine",
            "cool_food_or_routine",
            "regular_routine",
            "varies",
            "not_sure",
            "prefer_not_to_say",
        ],
        required=False,
    ),
    choice(
        "ayush_sattva",
        "dashavidha_pariksha",
        "How would you describe your usual response to stress?",
        ["usually_calm", "sometimes_stressed", "often_stressed", "not_sure", "prefer_not_to_say"],
        required=False,
    ),
    choice(
        "ayush_ahara_shakti",
        "dashavidha_pariksha",
        "How is your usual appetite?",
        ["reduced", "regular", "increased", "variable", "not_sure", "prefer_not_to_say"],
        required=False,
    ),
    choice(
        "ayush_vyayama_shakti",
        "dashavidha_pariksha",
        "How much activity can you usually tolerate?",
        ["low", "moderate", "high", "variable", "not_sure", "prefer_not_to_say"],
        required=False,
    ),
    choice(
        "ayush_vaya",
        "dashavidha_pariksha",
        "Which life stage best describes you?",
        ["child", "young_adult", "adult", "older_adult", "prefer_not_to_say"],
    ),
    choice(
        "ayush_ahara",
        "lifestyle_context",
        "How would you describe your usual diet?",
        [
            "mostly_home_cooked",
            "mixed_diet",
            "frequent_outside_food",
            "restricted_diet",
            "not_sure",
            "prefer_not_to_say",
        ],
    ),
    choice(
        "ayush_vihara",
        "lifestyle_context",
        "How would you describe your usual daily routine?",
        ["regular", "irregular", "poor_sleep", "physically_demanding", "not_sure", "prefer_not_to_say"],
    ),
    choice(
        "ayush_agni",
        "lifestyle_context",
        "How would you describe your digestion currently?",
        ["regular", "reduced", "irregular", "increased", "not_sure"],
    ),
    choice(
        "ayush_koshtha",
        "lifestyle_context",
        "How would you describe your usual bowel pattern?",
        ["regular", "constipation_tendency", "loose_stools_tendency", "variable", "not_sure"],
    ),
    choice(
        "ayush_nidana",
        "lifestyle_context",
        "What may be related to your current concern?",
        [
            "food_or_diet",
            "sleep_or_routine",
            "stress",
            "weather_or_environment",
            "not_sure",
            "prefer_not_to_say",
        ],
    ),
]

PATHWAYS: dict[str, list[dict[str, Any]]] = {
    CHEST_PATHWAY_VERSION: CHEST_QUESTIONS,
    FEVER_PATHWAY_VERSION: FEVER_QUESTIONS,
    HEADACHE_PATHWAY_VERSION: HEADACHE_QUESTIONS,
    ABDOMINAL_PAIN_PATHWAY_VERSION: ABDOMINAL_PAIN_QUESTIONS,
    AYUSH_PATHWAY_VERSION: AYUSH_QUESTIONS,
}

# Only English and Hindi are supported in the kiosk MVP. Controlled values remain
# English/stable so auditing, red-flag rules, summaries, and integrations never
# depend on translated display text.
HINDI_PROMPTS = {
    "chief_complaint": "कृपया आज की मुख्य तकलीफ़ की पुष्टि करें।",
    "chest_onset": "सीने में तकलीफ़ कब शुरू हुई?",
    "chest_character": "सीने की तकलीफ़ का कौन-सा वर्णन सबसे सही है?",
    "chest_radiation": "क्या यह तकलीफ़ शरीर के किसी और हिस्से में फैलती है?",
    "chest_severity": "अभी सीने की तकलीफ़ कितनी तेज़ है?",
    "chest_timing": "सीने की तकलीफ़ किस तरह होती है?",
    "breathlessness": "क्या आपको साँस लेने में तकलीफ़ हो रही है?",
    "sweating": "क्या इस तकलीफ़ के साथ असामान्य पसीना आ रहा है?",
    "chest_nausea_or_vomiting": "क्या इस तकलीफ़ के साथ मतली या उल्टी हो रही है?",
    "chest_dizziness_or_fainting": "क्या आपको चक्कर आ रहे हैं या आप बेहोश हुए हैं?",
    "onset_duration": "यह तकलीफ़ कब शुरू हुई?",
    "measured_temperature": "यदि पता हो, तो सबसे अधिक तापमान कितना था?",
    "chills": "क्या आपको ठंड लगना या कंपकंपी हुई है?",
    "fever_associated_symptoms": "इनमें से कौन-सा अन्य लक्षण सबसे अधिक महसूस हो रहा है?",
    "headache_location": "सिर के किस हिस्से में दर्द है?",
    "headache_severity": "सिरदर्द कितना तेज़ है?",
    "vision_changes": "क्या आपको दृष्टि में कोई बदलाव महसूस हुआ है?",
    "headache_associated_symptoms": "इनमें से कौन-सा अन्य लक्षण सबसे अधिक महसूस हो रहा है?",
    "abdominal_pain_location": "पेट में दर्द कहाँ है?",
    "abdominal_pain_severity": "पेट का दर्द कितना तेज़ है?",
    "nausea_or_vomiting": "क्या आपको मतली या उल्टी हुई है?",
    "bowel_or_urinary_changes": "क्या मल त्याग या पेशाब में कोई बदलाव महसूस हुआ है?",
    "allergies": "क्या आपको किसी दवा या चीज़ से एलर्जी है?",
    "current_medications": "क्या आप अभी कोई दवा ले रहे हैं?",
    "ayush_prakriti": "यदि आपको पता हो, तो अपनी सामान्य प्रकृति कैसे बताएँगे?",
    "ayush_vikriti": "आज आपको अपनी सामान्य अवस्था से क्या बदलाव महसूस हो रहा है?",
    "ayush_sara": "अपनी सामान्य शक्ति या ऊर्जा को कैसे बताएँगे?",
    "ayush_samhanana": "अपने शरीर की बनावट को कैसे बताएँगे?",
    "ayush_pramana": "क्या आप आज शरीर के माप की जानकारी देना चाहेंगे?",
    "ayush_satmya": "आपको सामान्यतः क्या सबसे अनुकूल लगता है?",
    "ayush_sattva": "तनाव के प्रति अपनी सामान्य प्रतिक्रिया को कैसे बताएँगे?",
    "ayush_ahara_shakti": "आपकी सामान्य भूख कैसी रहती है?",
    "ayush_vyayama_shakti": "आप सामान्यतः कितनी शारीरिक गतिविधि सहन कर पाते हैं?",
    "ayush_vaya": "आपके लिए कौन-सी आयु-अवस्था सबसे सही है?",
    "ayush_ahara": "अपने सामान्य आहार को कैसे बताएँगे?",
    "ayush_vihara": "अपनी सामान्य दिनचर्या को कैसे बताएँगे?",
    "ayush_agni": "वर्तमान में अपने पाचन को कैसे बताएँगे?",
    "ayush_koshtha": "अपनी सामान्य मल त्याग की आदत को कैसे बताएँगे?",
    "ayush_nidana": "आपके अनुसार आपकी वर्तमान तकलीफ़ किससे जुड़ी हो सकती है?",
}

HINDI_CHOICE_LABELS = {
    "chest_discomfort": "सीने में तकलीफ़",
    "fever": "बुखार",
    "headache": "सिरदर्द",
    "abdominal_pain": "पेट में दर्द",
    "other": "कुछ और",
    "within_last_hour": "पिछले एक घंटे में",
    "started_today": "आज शुरू हुआ",
    "today": "आज शुरू हुआ",
    "1_to_2_days": "1 से 2 दिन पहले",
    "1_to_7_days": "1 से 7 दिन पहले",
    "3_to_7_days": "3 से 7 दिन पहले",
    "more_than_a_week": "एक सप्ताह से अधिक पहले",
    "not_sure": "पता नहीं",
    "pressure_or_heaviness": "दबाव या भारीपन",
    "tightness": "जकड़न",
    "burning": "जलन",
    "sharp_or_stabbing": "चुभने वाला तेज़ दर्द",
    "dull_ache": "हल्का लगातार दर्द",
    "does_not_spread": "नहीं फैलता",
    "left_arm_or_shoulder": "बायाँ हाथ या कंधा",
    "right_arm_or_shoulder": "दायाँ हाथ या कंधा",
    "jaw_neck_or_back": "जबड़ा, गर्दन या पीठ",
    "more_than_one_area": "एक से अधिक जगह",
    "mild": "हल्का",
    "moderate": "मध्यम",
    "severe": "तेज़",
    "very_severe": "बहुत तेज़",
    "constant": "लगातार रहता है",
    "comes_and_goes": "आता-जाता है",
    "with_activity": "चलने-फिरने या काम करने पर",
    "at_rest": "आराम करते समय",
    "wakes_from_sleep": "नींद से जगाता है",
    "yes": "हाँ",
    "no": "नहीं",
    "no_known_allergies": "कोई ज्ञात एलर्जी नहीं",
    "yes_known_allergies": "हाँ, ज्ञात एलर्जी है",
    "prefer_not_to_say": "बताना नहीं चाहते",
    "no_current_medicines": "अभी कोई दवा नहीं ले रहे",
    "one_or_more_medicines": "एक या अधिक दवाएँ ले रहे हैं",
    "not_measured": "तापमान नहीं मापा",
    "below_38_c": "38°C से कम",
    "38_to_39_c": "38°C से 39°C",
    "above_39_c": "39°C से अधिक",
    "none": "कोई नहीं",
    "cough_or_cold_symptoms": "खाँसी या ज़ुकाम के लक्षण",
    "body_aches": "शरीर में दर्द",
    "nausea_or_vomiting": "मतली या उल्टी",
    "other_symptom": "कोई अन्य लक्षण",
    "front": "सिर के आगे",
    "back": "सिर के पीछे",
    "one_side": "एक तरफ़",
    "both_sides": "दोनों तरफ़",
    "all_over": "पूरे सिर में",
    "light_or_sound_sensitivity": "रोशनी या आवाज़ से परेशानी",
    "neck_discomfort": "गर्दन में तकलीफ़",
    "upper_abdomen": "पेट का ऊपरी हिस्सा",
    "lower_abdomen": "पेट का निचला हिस्सा",
    "right_side": "दाहिनी तरफ़",
    "left_side": "बाईं तरफ़",
    "no_change": "कोई बदलाव नहीं",
    "bowel_change": "मल त्याग में बदलाव",
    "urinary_change": "पेशाब में बदलाव",
    "both": "दोनों में बदलाव",
    "vata": "वात",
    "pitta": "पित्त",
    "kapha": "कफ",
    "mixed": "मिश्रित",
    "not_known": "पता नहीं",
    "pain_or_discomfort": "दर्द या तकलीफ़",
    "fever_or_warmth": "बुखार या गरमाहट",
    "digestive_change": "पाचन में बदलाव",
    "sleep_or_energy_change": "नींद या ऊर्जा में बदलाव",
    "other_change": "कोई अन्य बदलाव",
    "low": "कम",
    "good": "अच्छी",
    "slender": "पतला",
    "medium": "मध्यम",
    "broad": "चौड़ा/मज़बूत",
    "warm_food_or_routine": "गर्म भोजन या दिनचर्या",
    "cool_food_or_routine": "ठंडा भोजन या दिनचर्या",
    "regular_routine": "नियमित दिनचर्या",
    "varies": "बदलता रहता है",
    "usually_calm": "आमतौर पर शांत",
    "sometimes_stressed": "कभी-कभी तनाव",
    "often_stressed": "अक्सर तनाव",
    "reduced": "कम",
    "regular": "नियमित",
    "increased": "बढ़ी हुई",
    "variable": "बदलती रहती है",
    "high": "अधिक",
    "child": "बच्चा",
    "young_adult": "युवा वयस्क",
    "adult": "वयस्क",
    "older_adult": "वरिष्ठ वयस्क",
    "mostly_home_cooked": "अधिकतर घर का बना भोजन",
    "mixed_diet": "मिश्रित आहार",
    "frequent_outside_food": "अक्सर बाहर का भोजन",
    "restricted_diet": "सीमित आहार",
    "irregular": "अनियमित",
    "poor_sleep": "नींद कम या खराब",
    "physically_demanding": "शारीरिक रूप से मेहनत वाला",
    "constipation_tendency": "कब्ज़ की प्रवृत्ति",
    "loose_stools_tendency": "ढीले मल की प्रवृत्ति",
    "food_or_diet": "भोजन या आहार",
    "sleep_or_routine": "नींद या दिनचर्या",
    "stress": "तनाव",
    "weather_or_environment": "मौसम या वातावरण",
}


def localise_question(question: dict[str, Any], language: str) -> dict[str, Any]:
    """Return translated display text while retaining stable controlled values."""
    localised = dict(question)
    if language == "hi":
        localised["prompt"] = HINDI_PROMPTS[question["key"]]
        localised["choice_labels"] = {value: HINDI_CHOICE_LABELS[value] for value in question["choices"]}
    else:
        localised["choice_labels"] = {}
    return localised


def localise_fact_display(question_key: str, value: object, language: str) -> tuple[str, str]:
    """Provide patient-facing review text without changing persisted clinical values."""
    if language == "hi":
        label = HINDI_PROMPTS.get(question_key, question_key.replace("_", " "))
        value_label = HINDI_CHOICE_LABELS.get(str(value), str(value))
        return label, value_label
    return question_key.replace("_", " ").title(), str(value).replace("_", " ")


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
        if not (condition := question.get("when"))
        or all(answers.get(key) == value for key, value in condition.items())
    ]
