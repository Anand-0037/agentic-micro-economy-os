FROM ghcr.io/astral-sh/uv:python3.11-bookworm AS builder

WORKDIR /app
COPY apps/worker/pyproject.toml ./pyproject.toml
COPY apps/worker/README.md ./README.md
COPY apps/worker/ameo_worker ./ameo_worker
RUN uv pip install --system --no-cache .

FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY --from=builder /usr/local /usr/local
COPY apps/worker/ameo_worker ./ameo_worker
COPY apps/worker/eval_report.json ./eval_report.json
COPY bin/0g-storage-client /usr/local/bin/0g-storage-client

EXPOSE 8000
CMD ["uvicorn", "ameo_worker.main:app", "--host", "0.0.0.0", "--port", "8000"]
