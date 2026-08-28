FROM ghcr.io/astral-sh/uv:python3.12-trixie-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_NO_CACHE=1

WORKDIR /app

COPY pyproject.toml uv.lock ./

RUN uv sync --locked --no-install-project

COPY app ./app

RUN uv sync --locked

RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]