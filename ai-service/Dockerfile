FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD ["python", "-c", "import json,urllib.request; payload=json.load(urllib.request.urlopen('http://127.0.0.1:8000/live', timeout=2)); raise SystemExit(0 if payload.get('status') == 'ok' else 1)"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
