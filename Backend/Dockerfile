FROM ghcr.io/astral-sh/uv:latest AS uv_bin
FROM debian:bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY --from=uv_bin /uv /usr/local/bin/uv
RUN uv python install 3.12.3
RUN uv venv 
COPY requirements.txt .
RUN uv pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uv","run","uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]