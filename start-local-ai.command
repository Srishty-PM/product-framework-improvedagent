#!/bin/sh
# Dedicated Ollama process, with cloud disabled. Uses already installed weights.
export OLLAMA_NO_CLOUD=1
export OLLAMA_HOST=127.0.0.1:11435
ollama serve
