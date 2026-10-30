#!/usr/bin/env bash
# 黑盒契约测试：用 init.sql 重建独立的 PostgreSQL 库，编译并启动 Go 服务（独立上传目录、开启测试钩子），
# 再运行 server/tests 下的 pytest 用例通过 HTTP 校验。
# 用法：tools/run_contract_tests.sh [pytest 参数...]（不带参数时运行整个 tests/）
# 环境变量：PYTHON（装好 tests/requirements.txt 的解释器）、PGHOST/PGPORT/PGUSER/PGPASSWORD
# （默认 127.0.0.1/5432/postgres/空）、DB_NAME、PORT、WORK_DIR
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"   # server/（Go 模块根目录）
REPO="$(cd "$HERE/.." && pwd)"
PYTHON="${PYTHON:-python3}"
DB_NAME="${DB_NAME:-em_go_test}"
PORT="${PORT:-18080}"
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
PSQL="${PSQL:-$(command -v psql || echo /opt/homebrew/opt/postgresql@17/bin/psql)}"
WORK_DIR="${WORK_DIR:-$(mktemp -d)}"
mkdir -p "$WORK_DIR/uploads" "$WORK_DIR/logs"

"$PSQL" -q -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE);" -c "CREATE DATABASE \"$DB_NAME\" ENCODING 'UTF8';"
"$PSQL" -q -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$REPO/docs/references/database/init.sql" >/dev/null

(cd "$HERE" && go build -o "$WORK_DIR/server" ./cmd/server)
PGPASS_PART=""
if [ -n "${PGPASSWORD:-}" ]; then PGPASS_PART=":$PGPASSWORD"; fi
export APP_DATABASE_URL="postgresql+asyncpg://$PGUSER$PGPASS_PART@$PGHOST:$PGPORT/$DB_NAME"
export APP_JWT_SECRET="test-secret-that-is-long-enough-123456"
export APP_WECHAT_MINI_PROGRAM_APP_ID="wx-test-primary,wx-test-secondary"
export APP_WECHAT_MINI_PROGRAM_APP_SECRET="test-primary-secret,test-secondary-secret"
export APP_UPLOAD_DIR="$WORK_DIR/uploads"
export APP_LOG_DIR="$WORK_DIR/logs"
export APP_TEMPLATE_DIR="${APP_TEMPLATE_DIR:-$HERE/templates}"
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

cd "$HERE"
if [ $# -eq 0 ]; then set -- tests; fi
API_BASE_URL="http://127.0.0.1:$PORT" API_DATABASE_URL="$APP_DATABASE_URL" \
API_UPLOAD_DIR="$APP_UPLOAD_DIR" API_JWT_SECRET="$APP_JWT_SECRET" \
  "$PYTHON" -m pytest -c tests/pytest.ini -p no:cacheprovider -q "$@" || STATUS=$?
echo "server log: $WORK_DIR/server.log"
exit ${STATUS:-0}
