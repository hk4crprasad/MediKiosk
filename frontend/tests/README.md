# Kiosk demo E2E test

This test runs the English/Hindi patient journey with a mocked API, so it never needs Azure, a database, a token, or a real patient record. It proves the Hindi chest-discomfort flow, stable Hindi response language, automatic submission reset, and client session cleanup.

Install the browser test dependency once:

```bash
python -m pip install -r tests/requirements-demo-test.txt
python -m playwright install chromium
```

Run the repeatable demo check from `frontend/`:

```bash
npm run test:demo
```
