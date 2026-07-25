FROM python:3.11-slim AS builder

RUN pip install --no-cache-dir pip==24.2

WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir --user .

FROM python:3.11-slim

RUN groupadd -r app && useradd -r -g app -d /app -s /bin/false app

WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .

RUN mkdir -p data static && chown -R app:app /app

ENV PATH=/root/.local/bin:$PATH

EXPOSE 8000

USER app

CMD ["sh", "start.sh"]