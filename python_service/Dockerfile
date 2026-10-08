# Face recognition service — for a Hugging Face Docker Space (free CPU, 16 GB RAM).
# Uses the prebuilt dlib-bin Linux wheel, so nothing has to compile.
FROM python:3.10-slim

RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces run as a non-root user with uid 1000
RUN useradd -m -u 1000 user
WORKDIR /home/user/app

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn \
    && pip install --no-cache-dir face-recognition==1.3.0 --no-deps

COPY --chown=user . .
USER user

ENV PORT=7860
EXPOSE 7860
CMD ["sh", "-c", "gunicorn -w 1 --threads 4 -t 120 -b 0.0.0.0:${PORT} app:app"]
