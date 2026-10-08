# Face recognition service — optional Docker deploy (e.g. Render with Language: Docker).
# Uses the prebuilt dlib-bin Linux wheel, so nothing has to compile.
FROM python:3.10-slim

RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Run as a non-root user
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
