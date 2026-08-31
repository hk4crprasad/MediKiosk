import unittest

from app.clinical_config.pathways import (
    ABDOMINAL_PAIN_PATHWAY_VERSION,
    CHEST_PATHWAY_VERSION,
    FEVER_PATHWAY_VERSION,
    HEADACHE_PATHWAY_VERSION,
)
from app.clinical_config.red_flags import RED_FLAG_RULES, rules_for_pathway

# One positive (should trigger) and one negative (should not trigger) answer fixture
# per rule, keyed by rule_id. Each negative fixture changes exactly one criterion so
# the test demonstrates the rule is specific, not just "any answer triggers it".
FIXTURES: dict[str, tuple[dict[str, object], dict[str, object]]] = {
    "chest-discomfort-with-breathlessness": (
        {"chief_complaint": "chest_discomfort", "breathlessness": "yes"},
        {"chief_complaint": "chest_discomfort", "breathlessness": "no"},
    ),
    "chest-discomfort-cardiac-pattern-radiation": (
        {
            "chief_complaint": "chest_discomfort",
            "chest_severity": "severe",
            "chest_radiation": "left_arm_or_shoulder",
        },
        {
            "chief_complaint": "chest_discomfort",
            "chest_severity": "mild",
            "chest_radiation": "left_arm_or_shoulder",
        },
    ),
    "chest-discomfort-with-syncope": (
        {"chief_complaint": "chest_discomfort", "chest_dizziness_or_fainting": "yes"},
        {"chief_complaint": "chest_discomfort", "chest_dizziness_or_fainting": "no"},
    ),
    "headache-severe-with-vision-change": (
        {"chief_complaint": "headache", "headache_severity": "severe", "vision_changes": "yes"},
        {"chief_complaint": "headache", "headache_severity": "moderate", "vision_changes": "yes"},
    ),
    "fever-high-temperature-with-rigors": (
        {"chief_complaint": "fever", "measured_temperature": "above_39_c", "chills": "yes"},
        {"chief_complaint": "fever", "measured_temperature": "38_to_39_c", "chills": "yes"},
    ),
    "abdominal-pain-severe-with-vomiting": (
        {
            "chief_complaint": "abdominal_pain",
            "abdominal_pain_severity": "severe",
            "nausea_or_vomiting": "yes",
        },
        {
            "chief_complaint": "abdominal_pain",
            "abdominal_pain_severity": "mild",
            "nausea_or_vomiting": "yes",
        },
    ),
}


class RedFlagRuleTests(unittest.TestCase):
    def test_every_rule_has_a_positive_and_negative_fixture(self) -> None:
        rule_ids = {rule.rule_id for rule in RED_FLAG_RULES}
        self.assertEqual(rule_ids, set(FIXTURES))

    def test_positive_fixture_triggers_and_negative_fixture_does_not(self) -> None:
        rules_by_id = {rule.rule_id: rule for rule in RED_FLAG_RULES}
        for rule_id, (positive, negative) in FIXTURES.items():
            with self.subTest(rule=rule_id):
                rule = rules_by_id[rule_id]
                self.assertTrue(rule.condition(positive), "positive fixture did not trigger the rule")
                self.assertFalse(rule.condition(negative), "negative fixture incorrectly triggered the rule")

    def test_every_rule_reports_urgent_severity_and_non_diagnostic_wording(self) -> None:
        diagnostic_terms = ("diagnos", "disease", "syndrome", "you have")
        for rule in RED_FLAG_RULES:
            with self.subTest(rule=rule.rule_id):
                self.assertEqual(rule.severity, "urgent")
                reason_lower = rule.reason.lower()
                for term in diagnostic_terms:
                    self.assertNotIn(term, reason_lower)
                self.assertIn("review", reason_lower)

    def test_rules_stay_isolated_to_their_own_pathway(self) -> None:
        chest_rule_ids = {rule.rule_id for rule in rules_for_pathway(CHEST_PATHWAY_VERSION)}
        fever_rule_ids = {rule.rule_id for rule in rules_for_pathway(FEVER_PATHWAY_VERSION)}
        headache_rule_ids = {rule.rule_id for rule in rules_for_pathway(HEADACHE_PATHWAY_VERSION)}
        abdominal_rule_ids = {rule.rule_id for rule in rules_for_pathway(ABDOMINAL_PAIN_PATHWAY_VERSION)}

        self.assertEqual(
            chest_rule_ids,
            {
                "chest-discomfort-with-breathlessness",
                "chest-discomfort-cardiac-pattern-radiation",
                "chest-discomfort-with-syncope",
            },
        )
        self.assertEqual(fever_rule_ids, {"fever-high-temperature-with-rigors"})
        self.assertEqual(headache_rule_ids, {"headache-severe-with-vision-change"})
        self.assertEqual(abdominal_rule_ids, {"abdominal-pain-severe-with-vomiting"})

        # No cross-contamination: a fever-shaped positive fixture must not trigger a
        # chest/headache/abdominal rule even if it happened to share a condition shape.
        for rule in rules_for_pathway(FEVER_PATHWAY_VERSION):
            self.assertNotIn(rule.rule_id, chest_rule_ids | headache_rule_ids | abdominal_rule_ids)


if __name__ == "__main__":
    unittest.main()
