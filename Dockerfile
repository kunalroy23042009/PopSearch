FROM python:3.11-slim AS builder

RUN pip install --no-cache-dir pip==24.2

WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir --user . && \
    find /root/.local/bin -type f -exec chmod +x {} \;

FROM python:3.11-slim

RUN groupadd -r app && useradd -r -g app -d /app -s /bin/false app

WORKDIR /app
COPY --from=builder /root/.local /app/.local
COPY . .

RUN mkdir -p data && chown -R app:app /app

ENV PATH=/app/.local/bin:$PATH
ENV PYTHONPATH=/app/.local/lib/python3.11/site-packages:$PYTHONPATH

EXPOSE 8000

USER app

CMD ["sh", "start.sh"]