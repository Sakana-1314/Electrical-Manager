# 常用开发命令（在 server/ 目录执行）。
.PHONY: build run test vet sync-openapi contract-test

build:
	go build -o bin/server ./cmd/server

run:
	go run ./cmd/server

vet:
	go vet ./...

test:
	go test ./...

# 接口契约唯一来源是 ../docs/openapi.yaml；服务端内嵌一份副本供 /api/v1/openapi.json 与 MCP 使用。
sync-openapi:
	cp ../docs/openapi.yaml internal/openapi/openapi.yaml

# 黑盒契约测试（需要本机 PostgreSQL 与安装了 tests/requirements.txt 的 Python）。
contract-test:
	tools/run_contract_tests.sh
