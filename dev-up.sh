#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MYSQL_CONTAINER="agenthub-mysql"
REDIS_CONTAINER="agenthub-redis"
KAFKA_CONTAINER="agenthub-kafka"

MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-001020}"
MYSQL_DATABASE="${MYSQL_DATABASE:-agenthub}"
REDIS_PASSWORD="${REDIS_PASSWORD:-001020}"

info() {
  echo "[dev-up] $1"
}

has_container() {
  local name="$1"
  local id
  id="$(docker ps -aq -f "name=^${name}$")"
  [[ -n "$id" ]]
}

is_running() {
  local name="$1"
  local running
  running="$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || true)"
  [[ "$running" == "true" ]]
}

ensure_mysql() {
  if has_container "$MYSQL_CONTAINER"; then
    if ! is_running "$MYSQL_CONTAINER"; then
      info "启动已存在的 MySQL 容器: $MYSQL_CONTAINER"
      docker start "$MYSQL_CONTAINER" >/dev/null
    else
      info "MySQL 容器已在运行: $MYSQL_CONTAINER"
    fi
    return
  fi

  info "创建并启动 MySQL 容器: $MYSQL_CONTAINER"
  docker run -d --name "$MYSQL_CONTAINER" \
    -e MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
    -e MYSQL_DATABASE="$MYSQL_DATABASE" \
    -p 3306:3306 \
    mysql:8.0 \
    --character-set-server=utf8mb4 \
    --collation-server=utf8mb4_unicode_ci >/dev/null
}

ensure_redis() {
  if has_container "$REDIS_CONTAINER"; then
    if ! is_running "$REDIS_CONTAINER"; then
      info "启动已存在的 Redis 容器: $REDIS_CONTAINER"
      docker start "$REDIS_CONTAINER" >/dev/null
    else
      info "Redis 容器已在运行: $REDIS_CONTAINER"
    fi
    return
  fi

  info "创建并启动 Redis 容器: $REDIS_CONTAINER"
  docker run -d --name "$REDIS_CONTAINER" \
    -p 6379:6379 \
    redis:7 \
    redis-server --requirepass "$REDIS_PASSWORD" >/dev/null
}

ensure_kafka() {
  if has_container "$KAFKA_CONTAINER"; then
    if ! is_running "$KAFKA_CONTAINER"; then
      info "启动已存在的 Kafka 容器: $KAFKA_CONTAINER"
      docker start "$KAFKA_CONTAINER" >/dev/null
    else
      info "Kafka 容器已在运行: $KAFKA_CONTAINER"
    fi
    return
  fi

  info "创建并启动 Kafka 容器: $KAFKA_CONTAINER"
  docker run -d --name "$KAFKA_CONTAINER" \
    -p 9092:9092 \
    -e KAFKA_CFG_NODE_ID=1 \
    -e KAFKA_CFG_PROCESS_ROLES=broker,controller \
    -e KAFKA_CFG_CONTROLLER_LISTENER_NAMES=CONTROLLER \
    -e KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093 \
    -e KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \
    -e KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT \
    -e KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=1@127.0.0.1:9093 \
    -e KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE=true \
    -e ALLOW_PLAINTEXT_LISTENER=yes \
    bitnami/kafka:3.7 >/dev/null
}

wait_mysql_ready() {
  info "等待 MySQL 就绪..."
  for _ in $(seq 1 60); do
    if docker exec "$MYSQL_CONTAINER" mysqladmin ping -uroot "-p${MYSQL_ROOT_PASSWORD}" --silent >/dev/null 2>&1; then
      info "MySQL 已就绪"
      return
    fi
    sleep 2
  done
  echo "MySQL 启动超时，请检查容器日志: docker logs $MYSQL_CONTAINER" >&2
  exit 1
}

import_sql() {
  local sql_file="$1"
  if [[ ! -f "$ROOT_DIR/$sql_file" ]]; then
    echo "缺少 SQL 文件: $sql_file" >&2
    exit 1
  fi
  info "导入 $sql_file"
  docker exec -i "$MYSQL_CONTAINER" \
    mysql --default-character-set=utf8mb4 -uroot "-p${MYSQL_ROOT_PASSWORD}" "$MYSQL_DATABASE" < "$ROOT_DIR/$sql_file"
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

  ensure_mysql
  ensure_redis
  ensure_kafka
  wait_mysql_ready
  import_sql "agenthub.sql"
  up_milvus

  echo
  info "基础依赖已就绪。下一步请分别启动："
  echo "  1) Python AI 服务: cd ai-service && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"
  echo "  2) Java 后端: mvn spring-boot:run"
  echo "  3) 前端: cd agenthub-web && npm run dev"
}

main "$@"
