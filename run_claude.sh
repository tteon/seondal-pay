#!/usr/bin/env bash

# .env 파일이 존재하면 자동으로 환경변수 로드
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -o allexport
  source "$SCRIPT_DIR/.env"
  set +o allexport
fi

# Anthropic Auth Token (Moonshot API Key) 검사
: "${ANTHROPIC_AUTH_TOKEN:?Set ANTHROPIC_AUTH_TOKEN in your environment or .env file}"
export ANTHROPIC_AUTH_TOKEN

export ANTHROPIC_BASE_URL="https://api.moonshot.ai/anthropic"
export ANTHROPIC_MODEL="kimi-k3[1m]"
export ANTHROPIC_DEFAULT_OPUS_MODEL="kimi-k3[1m]"
export ANTHROPIC_DEFAULT_SONNET_MODEL="kimi-k3[1m]"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="kimi-k3[1m]"
export ANTHROPIC_DEFAULT_FABLE_MODEL="kimi-k3[1m]"
export CLAUDE_CODE_SUBAGENT_MODEL="kimi-k3[1m]"
export CLAUDE_CODE_AUTO_COMPACT_WINDOW="1048576"
export CLAUDE_CODE_EFFORT_LEVEL="max"

# 추가 인자 전달을 위해 "$@"를 포함하여 claude 실행
exec claude "$@"
