FROM python:3.12.11-slim-bookworm

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN addgroup --system --gid 10001 bi \
    && adduser --system --uid 10001 --ingroup bi --home /nonexistent --no-create-home bi
COPY --chown=bi:bi . .

USER 10001:10001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import json,urllib.request; payload=json.load(urllib.request.urlopen('http://127.0.0.1:8100/live', timeout=2)); raise SystemExit(0 if payload.get('status') == 'ok' else 1)"]

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]
