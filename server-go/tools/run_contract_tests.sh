#!/usr/bin/env bash
# 黑盒契约测试：启动 Go 服务（独立 MySQL 库 + 独立上传目录），用原 pytest 集成测试通过 HTTP 校验。
# 用法：tools/run_contract_tests.sh [pytest 参数...]
# 环境变量：PYTHON（含后端依赖的解释器）、MYSQL_DSN_URL（默认 root@127.0.0.1:3306）、DB_NAME、PORT、WORK_DIR
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
PYTHON="${PYTHON:-python3}"
DB_NAME="${DB_NAME:-em_go_test}"
PORT="${PORT:-18080}"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_USER="${MYSQL_USER:-root}"
WORK_DIR="${WORK_DIR:-$(mktemp -d)}"
mkdir -p "$WORK_DIR/uploads" "$WORK_DIR/logs"

mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" "$DB_NAME" < "$REPO/docs/references/database/init.sql"

(cd "$HERE" && go build -o "$WORK_DIR/server" ./cmd/server)
export APP_DATABASE_URL="mysql+asyncmy://$MYSQL_USER@$MYSQL_HOST:3306/$DB_NAME?charset=utf8mb4"
export APP_JWT_SECRET="test-secret-that-is-long-enough-123456"
export APP_WECHAT_MINI_PROGRAM_APP_ID="wx-test-primary,wx-test-secondary"
export APP_WECHAT_MINI_PROGRAM_APP_SECRET="test-primary-secret,test-secondary-secret"
export APP_UPLOAD_DIR="$WORK_DIR/uploads"
export APP_LOG_DIR="$WORK_DIR/logs"
export APP_TEMPLATE_DIR="$REPO/server/app/templates"
export APP_PORT="$PORT"
export APP_DISABLE_WORKERS=1
export APP_TEST_HOOKS=1
export NO_COLOR=1
"$WORK_DIR/server" > "$WORK_DIR/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:$PORT/health" >/dev/null && break
  sleep 0.1
done

cd "$REPO/server"
GO_SERVER_URL="http://127.0.0.1:$PORT" GO_UPLOAD_DIR="$WORK_DIR/uploads" \
TEST_DATABASE_URL="$APP_DATABASE_URL" \
  "$PYTHON" -m pytest -p no:cacheprovider -q "$@" || STATUS=$?
echo "server log: $WORK_DIR/server.log"
exit ${STATUS:-0}
