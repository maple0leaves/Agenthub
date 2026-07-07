#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MYSQL_CONTAINER="agenthub-mysql"
REDIS_CONTAINER="agenthub-redis"
KAFKA_CONTAINER="agenthub-kafka"

info() {
  echo "[dev-down] $1"
}

has_container() {
  local name="$1"
  local id
  id="$(docker ps -aq -f "name=^${name}$")"
  [[ -n "$id" ]]
}

stop_if_exists() {
  local name="$1"
  if has_container "$name"; then
    docker stop "$name" >/dev/null || true
    info "容器已停止: $name"
  else
    info "容器不存在，跳过: $name"
  fi
}

down_milvus() {
  info "停止 Milvus 相关容器（保留数据卷）"
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$ROOT_DIR/docker-compose.milvus.yml" down --remove-orphans
  else
    docker-compose -f "$ROOT_DIR/docker-compose.milvus.yml" down --remove-orphans
  fi
}

main() {
  info "检查 Docker 环境"
  docker version >/dev/null

  down_milvus
  stop_if_exists "$MYSQL_CONTAINER"
  stop_if_exists "$REDIS_CONTAINER"
  stop_if_exists "$KAFKA_CONTAINER"

  echo
  info "依赖服务已停止（数据卷保留）。"
  info "如需彻底清理 Milvus 数据，请手动执行 compose down -v。"
}

main "$@"
