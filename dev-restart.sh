#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MYSQL_CONTAINER="agenthub-mysql"
REDIS_CONTAINER="agenthub-redis"
KAFKA_CONTAINER="agenthub-kafka"

info() {
  echo "[dev-restart] $1"
}

has_container() {
  local name="$1"
  local id
  id="$(docker ps -aq -f "name=^${name}$")"
  [[ -n "$id" ]]
}

start_if_exists() {
  local name="$1"
  if has_container "$name"; then
    docker start "$name" >/dev/null || true
    info "容器已启动: $name"
  else
    echo "未找到容器 $name，请先执行: bash dev-up.sh" >&2
    exit 1
  fi
}

up_milvus() {
  info "启动 Milvus 依赖容器"
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$ROOT_DIR/docker-compose.milvus.yml" up -d
  else
    docker-compose -f "$ROOT_DIR/docker-compose.milvus.yml" up -d
  fi
}

main() {
  info "检查 Docker 环境"
  docker version >/dev/null

  start_if_exists "$MYSQL_CONTAINER"
  start_if_exists "$REDIS_CONTAINER"
  start_if_exists "$KAFKA_CONTAINER"
  up_milvus

  echo
  info "依赖服务已就绪（未导入 SQL，未重置数据）。"
  echo "下一步请分别启动："
  echo "  1) Python AI 服务: cd ai-service && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"
  echo "  2) Java 后端: mvn spring-boot:run"
  echo "  3) 前端: cd agenthub-web && npm run dev"
}

main "$@"
