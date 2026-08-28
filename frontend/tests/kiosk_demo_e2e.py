"""Repeatable, no-secrets browser proof for the Hindi chest-discomfort demo."""

import json
import subprocess
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "http://127.0.0.1:3000"
ENCOUNTER_ID = "00000000-0000-0000-0000-000000000111"

QUESTIONS = [
    ("chief_complaint", "कृपया आज की मुख्य तकलीफ़ की पुष्टि करें।", [("chest_discomfort", "सीने में तकलीफ़")]),
    ("chest_onset", "सीने में तकलीफ़ कब शुरू हुई?", [("within_last_hour", "पिछले एक घंटे में"), ("today", "आज शुरू हुआ")]),
    ("chest_character", "सीने की तकलीफ़ का कौन-सा वर्णन सबसे सही है?", [("pressure_or_heaviness", "दबाव या भारीपन"), ("tightness", "जकड़न")]),
    ("chest_radiation", "क्या यह तकलीफ़ शरीर के किसी और हिस्से में फैलती है?", [("does_not_spread", "नहीं फैलता"), ("left_arm_or_shoulder", "बायाँ हाथ या कंधा")]),
    ("chest_severity", "अभी सीने की तकलीफ़ कितनी तेज़ है?", [("mild", "हल्का"), ("moderate", "मध्यम")]),
    ("chest_timing", "सीने की तकलीफ़ किस तरह होती है?", [("constant", "लगातार रहता है"), ("comes_and_goes", "आता-जाता है")]),
    ("breathlessness", "क्या आपको साँस लेने में तकलीफ़ हो रही है?", [("no", "नहीं"), ("yes", "हाँ")]),
    ("sweating", "क्या इस तकलीफ़ के साथ असामान्य पसीना आ रहा है?", [("no", "नहीं"), ("yes", "हाँ")]),
    ("chest_nausea_or_vomiting", "क्या इस तकलीफ़ के साथ मतली या उल्टी हो रही है?", [("no", "नहीं"), ("yes", "हाँ")]),
    ("chest_dizziness_or_fainting", "क्या आपको चक्कर आ रहे हैं या आप बेहोश हुए हैं?", [("no", "नहीं"), ("yes", "हाँ")]),
    ("allergies", "क्या आपको किसी दवा या चीज़ से एलर्जी है?", [("no_known_allergies", "कोई ज्ञात एलर्जी नहीं")]),
    ("current_medications", "क्या आप अभी कोई दवा ले रहे हैं?", [("no_current_medicines", "अभी कोई दवा नहीं ले रहे")]),
]


def wait_for_server() -> None:
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            with urlopen(BASE_URL, timeout=1):
                return
        except OSError:
            time.sleep(0.25)
    raise RuntimeError("MediKiosk frontend did not start within 30 seconds")


def question_payload(index: int) -> dict | None:
    if index >= len(QUESTIONS):
        return None
    key, prompt, choices = QUESTIONS[index]
    return {
        "key": key,
        "section": "hpi",
        "prompt": prompt,
        "input_type": "single_choice",
        "required": True,
        "choices": [value for value, _ in choices],
        "choice_labels": dict(choices),
        "pathway_version": "chest-discomfort-v1",
    }


def run_demo() -> None:
    state = {"question_index": 0, "responses": [], "encounter_language": None, "consent_language": None}

    def handle_api(route):
        request = route.request
        path = request.url.split("/api/v1", 1)[-1]
        if path == "/encounters" and request.method == "POST":
            state["encounter_language"] = request.post_data_json["patient"]["preferred_language"]
            route.fulfill(status=201, content_type="application/json", body=json.dumps({"encounter": {"id": ENCOUNTER_ID, "pathway_version": "chest-discomfort-v1", "status": "DRAFT"}, "kiosk_session_token": "demo-token", "kiosk_token_expires_in_seconds": 3600}))
        elif path == f"/encounters/{ENCOUNTER_ID}/consents" and request.method == "POST":
            state["consent_language"] = request.post_data_json["language"]
            route.fulfill(status=201, content_type="application/json", body=json.dumps({"id": "consent-1", "encounter_id": ENCOUNTER_ID, "consent_type": "clinical_intake", "version": "v1", "language": "hi", "granted": True, "created_at": "2026-08-28T00:00:00Z"}))
        elif path == f"/encounters/{ENCOUNTER_ID}" and request.method == "GET":
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": ENCOUNTER_ID, "status": "IN_PROGRESS", "pathway_version": "chest-discomfort-v1"}))
        elif path == f"/encounters/{ENCOUNTER_ID}/intake/next-question":
            route.fulfill(status=200, content_type="application/json", body=json.dumps(question_payload(state["question_index"])))
        elif path == f"/encounters/{ENCOUNTER_ID}/intake/responses" and request.method == "POST":
            payload = request.post_data_json
            expected = QUESTIONS[state["question_index"]][0]
            assert payload["question_key"] == expected
            assert payload["language"] == "hi"
            state["responses"].append(payload)
            state["question_index"] += 1
            route.fulfill(status=201, content_type="application/json", body=json.dumps({"response_id": f"response-{state['question_index']}", "encounter_status": "IN_PROGRESS", "created_facts": [], "active_red_flag_ids": []}))
        elif path == f"/encounters/{ENCOUNTER_ID}/facts":
            route.fulfill(status=200, content_type="application/json", body=json.dumps([]))
        elif path == f"/encounters/{ENCOUNTER_ID}/submit" and request.method == "POST":
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"encounter": {"id": ENCOUNTER_ID, "status": "SUBMITTED", "pathway_version": "chest-discomfort-v1"}, "missing_question_keys": []}))
        else:
            route.fulfill(status=404, content_type="application/json", body='{"detail":"unmocked demo request"}')

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1024, "height": 1366})
        page.route("**/api/v1/**", handle_api)
        page.goto(f"{BASE_URL}/kiosk/start", wait_until="networkidle")
        page.get_by_role("button", name="हिंदी").click()
        expect(page.get_by_text("आज आप किस तकलीफ़ के लिए आए हैं?")).to_be_visible()
        page.get_by_role("button", name="सहमति के लिए आगे बढ़ें →").click()
        expect(page.get_by_text("आपकी सहमति और गोपनीयता।")).to_be_visible()
        page.get_by_role("button", name="मैं सहमत हूँ — इंटेक शुरू करें →").click()
        expect(page.get_by_text("कृपया आज की मुख्य तकलीफ़ की पुष्टि करें।")).to_be_visible()
        expect(page.get_by_role("button", name="सीने में तकलीफ़")).to_be_visible()

        for index in range(len(QUESTIONS)):
            expected_prompt = QUESTIONS[index][1]
            expect(page.get_by_text(expected_prompt)).to_be_visible()
            page.locator('[aria-label="उत्तर विकल्प"] button').first.click()
            page.get_by_role("button", name="सहेजें और आगे बढ़ें →").click()
            page.wait_for_timeout(75)

        expect(page.get_by_text("भेजने से पहले समीक्षा करें।")).to_be_visible()
        page.get_by_role("button", name="क्लिनिकल टीम को भेजें →").click()
        expect(page.get_by_text("आपका इंटेक क्लिनिकल टीम के पास है।")).to_be_visible()
        expect(page).to_have_url(f"{BASE_URL}/kiosk/start", timeout=12_000)
        assert page.evaluate("sessionStorage.getItem('medikiosk.kiosk_token')") is None
        assert state["encounter_language"] == "hi"
        assert state["consent_language"] == "hi"
        assert len(state["responses"]) == len(QUESTIONS)

        # The demo build uses the documented 30-second minimum timeout.  Do not interact
        # after creating the next Hindi encounter; its consent screen must reset itself.
        page.get_by_role("button", name="हिंदी").click()
        page.get_by_role("button", name="सहमति के लिए आगे बढ़ें →").click()
        expect(page.get_by_text("आपकी सहमति और गोपनीयता।")).to_be_visible()
        page.wait_for_timeout(31_000)
        expect(page).to_have_url(f"{BASE_URL}/kiosk/start", timeout=5_000)
        assert page.evaluate("sessionStorage.getItem('medikiosk.kiosk_token')") is None
        browser.close()


if __name__ == "__main__":
    server = subprocess.Popen(["npm", "run", "start", "--", "--hostname", "127.0.0.1"], cwd=PROJECT_ROOT)
    try:
        wait_for_server()
        run_demo()
        print("PASS: Hindi chest-discomfort demo verified submission and inactivity kiosk resets.")
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
