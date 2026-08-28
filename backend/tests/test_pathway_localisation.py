import unittest

from app.clinical_config.pathways import (
    CHEST_PATHWAY_VERSION,
    PATHWAYS,
    localise_fact_display,
    localise_question,
)


class PathwayLocalisationTests(unittest.TestCase):
    def test_every_kiosk_question_has_complete_hindi_display_text(self) -> None:
        for pathway_version, questions in PATHWAYS.items():
            for question in questions:
                with self.subTest(pathway=pathway_version, question=question["key"]):
                    localised = localise_question(question, "hi")
                    self.assertNotEqual(localised["prompt"], question["prompt"])
                    self.assertEqual(set(localised["choice_labels"]), set(question["choices"]))
                    self.assertTrue(all(localised["choice_labels"].values()))

    def test_english_keeps_controlled_values_and_does_not_need_display_mapping(self) -> None:
        question = PATHWAYS[CHEST_PATHWAY_VERSION][1]
        localised = localise_question(question, "en")
        self.assertEqual(localised["prompt"], question["prompt"])
        self.assertEqual(localised["choice_labels"], {})

    def test_chest_pathway_collects_structured_hpi_before_associated_symptoms(self) -> None:
        keys = [question["key"] for question in PATHWAYS[CHEST_PATHWAY_VERSION]]
        self.assertEqual(
            keys[:7],
            [
                "chief_complaint",
                "chest_onset",
                "chest_character",
                "chest_radiation",
                "chest_severity",
                "chest_timing",
                "breathlessness",
            ],
        )

    def test_hindi_review_keeps_patient_facing_labels_separate_from_stable_values(self) -> None:
        label, value = localise_fact_display("chest_character", "pressure_or_heaviness", "hi")
        self.assertEqual(label, "सीने की तकलीफ़ का कौन-सा वर्णन सबसे सही है?")
        self.assertEqual(value, "दबाव या भारीपन")


if __name__ == "__main__":
    unittest.main()
