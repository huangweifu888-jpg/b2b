# Build context: repository root (00-platform-source)
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend

WORKDIR /app/backend
COPY backend/requirements.lock.txt /tmp/requirements.lock.txt
RUN pip install --no-cache-dir --disable-pip-version-check -r /tmp/requirements.lock.txt \
    && useradd --system --create-home --uid 10001 b2b

COPY backend /app/backend
COPY platform /app/platform
COPY tools /app/tools
RUN mkdir -p /srv/b2b/runtime/logs \
    && chown -R b2b:b2b /app /srv/b2b/runtime

USER b2b
EXPOSE 8000
CMD ["python", "-m", "scripts.container_entrypoint"]
