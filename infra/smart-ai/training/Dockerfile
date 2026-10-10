FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models-cache \
    HUGGINGFACE_HUB_CACHE=/models-cache/hub \
    TRANSFORMERS_CACHE=/models-cache/transformers

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY infra/smart-ai/training/requirements.txt /workspace/requirements.txt
RUN python3 -m pip install --upgrade pip && pip install -r /workspace/requirements.txt

COPY backend/ai/training /workspace/backend/ai/training
COPY infra/smart-ai/training /workspace/infra/smart-ai/training

ENTRYPOINT ["python3"]
CMD ["infra/smart-ai/training/train_smart_ai.py"]
