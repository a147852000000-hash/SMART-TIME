FROM vllm/vllm-openai:v0.11.0

USER root
RUN python -m pip install --no-cache-dir huggingface_hub==0.35.3
COPY bootstrap.sh /opt/smart-ai/bootstrap.sh
RUN chmod +x /opt/smart-ai/bootstrap.sh
ENTRYPOINT ["/opt/smart-ai/bootstrap.sh"]
