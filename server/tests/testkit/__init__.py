"""黑盒契约测试的公共工具：被测服务的连接配置、直连数据库的 ORM 模型与会话、契约常量。

测试只通过 HTTP 调用独立运行的服务（见 tools/run_contract_tests.sh）；这里的模型与会话
只用于造种子数据、核对落库结果，表结构以 docs/references/database/init.sql 为准。
"""
