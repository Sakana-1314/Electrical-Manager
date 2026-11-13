-- 电气车间备件管理系统 PostgreSQL 16+ 初始化脚本
-- 使用方式：先在 PostgreSQL 中创建空数据库，再连接该数据库执行本文件。
-- 本脚本不创建数据库或数据库账号，也不会由业务容器自动执行。
-- 可重复执行：类型 / 表 / 索引均按「已存在则跳过」处理，种子数据按唯一键更新或跳过。

-- 枚举类型：库内保存枚举「名」（如 PENDING），接口按枚举「值」输出中文字段见各表注释。
DO $$
BEGIN
  CREATE TYPE hazardstatus AS ENUM ('PENDING', 'BLOCKED', 'DONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE hazardlevel AS ENUM ('GENERAL', 'MAJOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE operationtype AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE sourcetype AS ENUM ('MANUAL', 'MINI_PROGRAM', 'REVERSAL', 'INITIALIZATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE purchaseplanstatus AS ENUM ('NORMAL', 'DEFERRED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE sharetype AS ENUM ('PURCHASE_PLAN', 'PURCHASE_RECORD');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE webhookplatform AS ENUM ('FEISHU', 'DINGTALK');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE webhookeventtype AS ENUM ('STOCK_OUTBOUND_CREATED', 'STOCK_INBOUND_CREATED', 'MINI_PROGRAM_USER_BOUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE webhookdeliverystatus AS ENUM ('PENDING', 'SENDING', 'SUCCEEDED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE excelimportjobstatus AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE excelexportjobstatus AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE worktaskstatus AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'PAUSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE workhalfday AS ENUM ('AM', 'PM');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

-- 项目（业务数据隔离维度）：所有业务表都带 project_id，同一时刻只能看到当前项目的数据。
-- 项目只对外显示名称，标识用自增 id（请求头 X-Project-Id / 链接参数 project_id 都用它，不外显编码）。
-- is_default 标记唯一的默认项目：小程序 / MCP 未指定项目时用它兜底。

CREATE TABLE IF NOT EXISTS project (
  id BIGSERIAL NOT NULL,
  name VARCHAR(128) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  remark VARCHAR(500) NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_project PRIMARY KEY (id),
  CONSTRAINT uq_project_name UNIQUE (name)
);

-- 统一用户：不再区分管理端 / 小程序端来源。任何账号都可以用用户名密码 / 接口令牌 / 微信扫码登录网页，
-- 绑定微信 openid 后也可以用小程序；小程序只有一个（一个 app_id），openid 直接落在本表且非空时唯一。
-- 未设置密码 / 接口令牌的账号对应列为空串，唯一性只约束非空值（部分唯一索引）。
-- 权限不再走角色表：permissions 是 BIGINT 位图，每一位对应一个权限点（见 server/internal/domain/permissions.go），
-- 两端共用；功能是否展示与接口是否放行都按位判断，写权限自动包含同模块读权限。
CREATE TABLE IF NOT EXISTS app_user (
  id BIGSERIAL NOT NULL,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  api_token_hash VARCHAR(64) NOT NULL DEFAULT '',
  api_token_enc VARCHAR(512) NOT NULL DEFAULT '',
  display_name VARCHAR(128) NOT NULL,
  department_name VARCHAR(128) NOT NULL DEFAULT '',
  wechat_openid VARCHAR(128) NULL,
  permissions BIGINT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMP WITHOUT TIME ZONE NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_app_user PRIMARY KEY (id),
  CONSTRAINT uq_app_user_username UNIQUE (username)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_api_token_hash ON app_user (api_token_hash) WHERE api_token_hash <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_wechat_openid ON app_user (wechat_openid) WHERE wechat_openid IS NOT NULL;

CREATE TABLE IF NOT EXISTS business_event_log (
  id BIGSERIAL NOT NULL,
  business_type VARCHAR(64) NOT NULL,
  business_id BIGINT NOT NULL,
  action VARCHAR(64) NOT NULL,
  old_status VARCHAR(32) NULL,
  new_status VARCHAR(32) NULL,
  occurred_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  remark VARCHAR(1000) NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  CONSTRAINT pk_business_event_log PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_business_event_entity
  ON business_event_log (business_type, business_id, id);

CREATE TABLE IF NOT EXISTS system_setting (
  setting_key VARCHAR(64) NOT NULL,
  setting_value JSON NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pk_system_setting PRIMARY KEY (setting_key)
);

CREATE TABLE IF NOT EXISTS webhook_delivery (
  id BIGSERIAL NOT NULL,
  event_id VARCHAR(36) NOT NULL,
  event_type webhookeventtype NOT NULL,
  platform webhookplatform NOT NULL,
  payload JSON NOT NULL,
  status webhookdeliverystatus NOT NULL DEFAULT 'PENDING',
  attempts SMALLINT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  response_status INTEGER NULL,
  response_excerpt VARCHAR(1000) NULL,
  last_error VARCHAR(1000) NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP WITHOUT TIME ZONE NULL,
  CONSTRAINT pk_webhook_delivery PRIMARY KEY (id),
  CONSTRAINT uq_webhook_delivery_event_id_platform UNIQUE (event_id, platform)
);

CREATE INDEX IF NOT EXISTS ix_webhook_delivery_pending
  ON webhook_delivery (status, next_retry_at, id);

CREATE TABLE IF NOT EXISTS file_object (
  id VARCHAR(36) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(32) NOT NULL,
  size_bytes BIGINT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  source_sha256 VARCHAR(64) NULL,
  source_probes JSON NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
  CONSTRAINT pk_file_object PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_file_object_sha256 ON file_object (sha256);
CREATE INDEX IF NOT EXISTS ix_file_object_source_sha256 ON file_object (source_sha256);
CREATE INDEX IF NOT EXISTS ix_file_object_deleted_at ON file_object (deleted_at);

CREATE TABLE IF NOT EXISTS material_code_library (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  material_code VARCHAR(64) NOT NULL,
  name VARCHAR(128) NULL,
  model_spec VARCHAR(255) NULL,
  unit_name VARCHAR(32) NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pk_material_code_library PRIMARY KEY (id),
  CONSTRAINT uq_material_code_library_project_material_code UNIQUE (project_id, material_code),
  CONSTRAINT fk_material_code_library_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_material_code_library_project_id
  ON material_code_library (project_id);

CREATE TABLE IF NOT EXISTS material_price (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  material_code VARCHAR(64) NOT NULL,
  unit_price NUMERIC(18, 6) NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pk_material_price PRIMARY KEY (id),
  CONSTRAINT uq_material_price_project_material_code UNIQUE (project_id, material_code),
  CONSTRAINT fk_material_price_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_material_price_project_id ON material_price (project_id);

CREATE TABLE IF NOT EXISTS excel_import_job (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  import_type VARCHAR(32) NOT NULL,
  status excelimportjobstatus NOT NULL DEFAULT 'PENDING',
  original_filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  result JSON NULL,
  error_code VARCHAR(64) NULL,
  error_message VARCHAR(1000) NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITHOUT TIME ZONE NULL,
  finished_at TIMESTAMP WITHOUT TIME ZONE NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pk_excel_import_job PRIMARY KEY (id),
  CONSTRAINT fk_excel_import_job_created_by_user
    FOREIGN KEY (created_by) REFERENCES app_user (id),
  CONSTRAINT fk_excel_import_job_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_excel_import_job_type_status
  ON excel_import_job (import_type, status, id);
CREATE INDEX IF NOT EXISTS ix_excel_import_job_project_id ON excel_import_job (project_id);

CREATE TABLE IF NOT EXISTS excel_export_job (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  export_type VARCHAR(32) NOT NULL,
  status excelexportjobstatus NOT NULL DEFAULT 'PENDING',
  download_filename VARCHAR(255) NULL,
  file_path VARCHAR(500) NULL,
  params JSON NULL,
  result JSON NULL,
  error_code VARCHAR(64) NULL,
  error_message VARCHAR(1000) NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITHOUT TIME ZONE NULL,
  finished_at TIMESTAMP WITHOUT TIME ZONE NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pk_excel_export_job PRIMARY KEY (id),
  CONSTRAINT fk_excel_export_job_created_by_user
    FOREIGN KEY (created_by) REFERENCES app_user (id),
  CONSTRAINT fk_excel_export_job_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_excel_export_job_type_status
  ON excel_export_job (export_type, status, id);
CREATE INDEX IF NOT EXISTS ix_excel_export_job_project_id ON excel_export_job (project_id);

CREATE TABLE IF NOT EXISTS share_link (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  token VARCHAR(36) NOT NULL,
  share_type sharetype NOT NULL,
  item_ids JSON NOT NULL,
  columns JSON NULL,
  expires_at TIMESTAMP WITHOUT TIME ZONE NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pk_share_link PRIMARY KEY (id),
  CONSTRAINT uq_share_link_token UNIQUE (token),
  CONSTRAINT fk_share_link_created_by_user
    FOREIGN KEY (created_by) REFERENCES app_user (id),
  CONSTRAINT fk_share_link_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_share_link_expires_at ON share_link (expires_at);
CREATE INDEX IF NOT EXISTS ix_share_link_share_type ON share_link (share_type);
CREATE INDEX IF NOT EXISTS ix_share_link_project_id ON share_link (project_id);

CREATE TABLE IF NOT EXISTS huaxing_inventory (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  first_inbound_date DATE NULL,
  warehouse VARCHAR(128) NULL,
  material_code VARCHAR(64) NULL,
  name VARCHAR(255) NULL,
  model_spec VARCHAR(255) NULL,
  quantity NUMERIC(18, 2) NULL,
  unit_name VARCHAR(32) NULL,
  purchaser VARCHAR(128) NULL,
  purchase_department VARCHAR(128) NULL,
  subitem_no_name VARCHAR(255) NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pk_huaxing_inventory PRIMARY KEY (id),
  CONSTRAINT fk_huaxing_inventory_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_huaxing_inventory_first_inbound_date
  ON huaxing_inventory (first_inbound_date);
CREATE INDEX IF NOT EXISTS ix_huaxing_inventory_project_id ON huaxing_inventory (project_id);

CREATE TABLE IF NOT EXISTS lite_inventory (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  name VARCHAR(128) NOT NULL,
  model_spec VARCHAR(255) NULL,
  unit_name VARCHAR(32) NULL,
  quantity NUMERIC(18, 2) NULL,
  remark VARCHAR(1000) NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pk_lite_inventory PRIMARY KEY (id),
  CONSTRAINT fk_lite_inventory_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_lite_inventory_project_id ON lite_inventory (project_id);

CREATE TABLE IF NOT EXISTS purchase_request (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  purchase_order_no VARCHAR(128) NULL,
  contract_no VARCHAR(128) NULL,
  vessel_no VARCHAR(128) NULL,
  consolidation_date DATE NULL,
  consolidation_port VARCHAR(128) NULL,
  sailing_date DATE NULL,
  remark VARCHAR(1000) NULL,
  purchase_date DATE NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_purchase_request PRIMARY KEY (id),
  CONSTRAINT fk_purchase_request_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_purchase_request_project_id ON purchase_request (project_id);

CREATE TABLE IF NOT EXISTS stock_material (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  uuid VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  name_id VARCHAR(128) NULL,
  alias VARCHAR(128) NULL,
  model_spec VARCHAR(255) NOT NULL,
  unit_name VARCHAR(32) NOT NULL,
  remark VARCHAR(1000) NULL,
  identity_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_stock_material PRIMARY KEY (id),
  CONSTRAINT uq_stock_material_uuid UNIQUE (uuid),
  CONSTRAINT uq_stock_material_project_identity_hash UNIQUE (project_id, identity_hash),
  CONSTRAINT fk_stock_material_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_stock_material_project_id ON stock_material (project_id);

CREATE TABLE IF NOT EXISTS stock_operation (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  operation_no VARCHAR(32) NOT NULL,
  operation_type operationtype NOT NULL,
  occurred_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  business_reason VARCHAR(500) NOT NULL,
  receiver_unit VARCHAR(128) NULL,
  receiver_name VARCHAR(64) NULL,
  subitem_no VARCHAR(64) NULL,
  source_type sourcetype NOT NULL,
  reversal_of_id BIGINT NULL,
  client_request_id VARCHAR(64) NOT NULL,
  mini_program_user_name_snapshot VARCHAR(128) NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_stock_operation PRIMARY KEY (id),
  CONSTRAINT uq_stock_operation_project_operation_no UNIQUE (project_id, operation_no),
  CONSTRAINT uq_stock_operation_project_client_request_id UNIQUE (project_id, client_request_id),
  CONSTRAINT fk_stock_operation_reversal_of_id_stock_operation
    FOREIGN KEY (reversal_of_id) REFERENCES stock_operation (id),
  CONSTRAINT fk_stock_operation_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_stock_operation_occurred_at ON stock_operation (occurred_at);
CREATE INDEX IF NOT EXISTS ix_stock_operation_source_occurred
  ON stock_operation (source_type, occurred_at);
CREATE INDEX IF NOT EXISTS ix_stock_operation_type_occurred
  ON stock_operation (operation_type, occurred_at);
CREATE INDEX IF NOT EXISTS ix_stock_operation_reversal_of_id
  ON stock_operation (reversal_of_id);
CREATE INDEX IF NOT EXISTS ix_stock_operation_project_id ON stock_operation (project_id);
-- 操作记录默认排序（发生时间倒序）分页与工作台「今日出入库」计数。
CREATE INDEX IF NOT EXISTS ix_stock_operation_project_occurred
  ON stock_operation (project_id, occurred_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS purchase_material (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  plan_no VARCHAR(32) NOT NULL,
  plan_date DATE NOT NULL,
  material_code VARCHAR(64) NULL,
  category VARCHAR(64) NULL,
  urgency VARCHAR(32) NOT NULL DEFAULT '正常',
  demand_department VARCHAR(128) NOT NULL DEFAULT 'HXNI 检修维护部',
  name VARCHAR(128) NOT NULL,
  model_spec VARCHAR(255) NOT NULL,
  unit_name VARCHAR(32) NOT NULL,
  actual_demand_person VARCHAR(128) NOT NULL,
  purchase_responsible VARCHAR(128) NOT NULL,
  planned_qty NUMERIC(18, 1) NOT NULL,
  usage VARCHAR(500) NOT NULL,
  subitem_no VARCHAR(64) NULL,
  remark VARCHAR(1000) NULL,
  stock_material_id BIGINT NULL,
  status purchaseplanstatus NOT NULL DEFAULT 'NORMAL',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_purchase_material PRIMARY KEY (id),
  CONSTRAINT uq_purchase_material_project_plan_no UNIQUE (project_id, plan_no),
  CONSTRAINT fk_purchase_material_stock_material_id_stock_material
    FOREIGN KEY (stock_material_id) REFERENCES stock_material (id),
  CONSTRAINT fk_purchase_material_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

-- 列表与工作台都先按项目再按状态过滤，单列 status 索引在多项目下选择性差。
CREATE INDEX IF NOT EXISTS ix_purchase_material_project_status ON purchase_material (project_id, status);
CREATE INDEX IF NOT EXISTS ix_purchase_material_stock_material_id
  ON purchase_material (stock_material_id);
CREATE INDEX IF NOT EXISTS ix_purchase_material_project_id ON purchase_material (project_id);

CREATE TABLE IF NOT EXISTS stock_balance (
  stock_material_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  quantity NUMERIC(18, 1) NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pk_stock_balance PRIMARY KEY (stock_material_id),
  CONSTRAINT fk_stock_balance_stock_material_id_stock_material
    FOREIGN KEY (stock_material_id) REFERENCES stock_material (id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_balance_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_stock_balance_project_id ON stock_balance (project_id);

CREATE TABLE IF NOT EXISTS stock_material_image (
  material_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  file_id VARCHAR(36) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT pk_stock_material_image PRIMARY KEY (material_id, file_id),
  CONSTRAINT fk_stock_material_image_material_id_stock_material
    FOREIGN KEY (material_id) REFERENCES stock_material (id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_material_image_file_id_file_object
    FOREIGN KEY (file_id) REFERENCES file_object (id),
  CONSTRAINT fk_stock_material_image_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_stock_material_image_project_id
  ON stock_material_image (project_id);
-- 附件引用计数、悬空清理与删除前预检都按 file_id 反查（主键以 owner_id 开头用不上）。
CREATE INDEX IF NOT EXISTS ix_stock_material_image_file_id ON stock_material_image (file_id);

CREATE TABLE IF NOT EXISTS stock_replenishment_policy (
  stock_material_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  minimum_qty NUMERIC(18, 1) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_stock_replenishment_policy PRIMARY KEY (stock_material_id),
  CONSTRAINT ck_stock_replenishment_policy_minimum_nonnegative CHECK (minimum_qty >= 0),
  CONSTRAINT fk_stock_replenishment_policy_stock_material_id_stock_material
    FOREIGN KEY (stock_material_id) REFERENCES stock_material (id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_replenishment_policy_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_stock_replenishment_policy_project_id
  ON stock_replenishment_policy (project_id);

CREATE TABLE IF NOT EXISTS purchase_material_image (
  material_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  file_id VARCHAR(36) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT pk_purchase_material_image PRIMARY KEY (material_id, file_id),
  CONSTRAINT fk_purchase_material_image_material_id_purchase_material
    FOREIGN KEY (material_id) REFERENCES purchase_material (id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_material_image_file_id_file_object
    FOREIGN KEY (file_id) REFERENCES file_object (id),
  CONSTRAINT fk_purchase_material_image_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_purchase_material_image_project_id
  ON purchase_material_image (project_id);
-- 附件引用计数、悬空清理与删除前预检都按 file_id 反查（主键以 owner_id 开头用不上）。
CREATE INDEX IF NOT EXISTS ix_purchase_material_image_file_id ON purchase_material_image (file_id);

CREATE TABLE IF NOT EXISTS purchase_plan_template (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  material_code VARCHAR(64) NULL,
  category VARCHAR(64) NULL,
  urgency VARCHAR(32) NOT NULL DEFAULT '正常',
  demand_department VARCHAR(128) NOT NULL DEFAULT 'HXNI 检修维护部',
  name VARCHAR(128) NOT NULL,
  model_spec VARCHAR(255) NOT NULL,
  unit_name VARCHAR(32) NOT NULL,
  actual_demand_person VARCHAR(128) NOT NULL,
  purchase_responsible VARCHAR(128) NOT NULL,
  planned_qty NUMERIC(18, 1) NOT NULL,
  usage VARCHAR(500) NOT NULL,
  subitem_no VARCHAR(64) NULL,
  remark VARCHAR(1000) NULL,
  stock_material_id BIGINT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_purchase_plan_template PRIMARY KEY (id),
  CONSTRAINT fk_purchase_plan_template_stock_material_id_stock_material
    FOREIGN KEY (stock_material_id) REFERENCES stock_material (id),
  CONSTRAINT fk_purchase_plan_template_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_purchase_plan_template_stock_material_id
  ON purchase_plan_template (stock_material_id);
CREATE INDEX IF NOT EXISTS ix_purchase_plan_template_project_id
  ON purchase_plan_template (project_id);

CREATE TABLE IF NOT EXISTS purchase_plan_template_image (
  plan_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  file_id VARCHAR(36) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT pk_purchase_plan_template_image PRIMARY KEY (plan_id, file_id),
  CONSTRAINT fk_purchase_plan_template_image_plan_id_purchase_plan_template
    FOREIGN KEY (plan_id) REFERENCES purchase_plan_template (id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_plan_template_image_file_id_file_object
    FOREIGN KEY (file_id) REFERENCES file_object (id),
  CONSTRAINT fk_purchase_plan_template_image_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_purchase_plan_template_image_project_id
  ON purchase_plan_template_image (project_id);
-- 附件引用计数、悬空清理与删除前预检都按 file_id 反查（主键以 owner_id 开头用不上）。
CREATE INDEX IF NOT EXISTS ix_purchase_plan_template_image_file_id ON purchase_plan_template_image (file_id);

CREATE TABLE IF NOT EXISTS purchase_request_line (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  purchase_request_id BIGINT NOT NULL,
  purchase_material_id BIGINT NULL,
  plan_no_snapshot VARCHAR(32) NOT NULL,
  plan_date_snapshot DATE NOT NULL,
  material_code_snapshot VARCHAR(64) NULL,
  category_snapshot VARCHAR(64) NULL,
  demand_department_snapshot VARCHAR(128) NOT NULL,
  material_name_snapshot VARCHAR(128) NOT NULL,
  model_spec_snapshot VARCHAR(255) NOT NULL,
  unit_name_snapshot VARCHAR(32) NOT NULL,
  actual_demand_person_snapshot VARCHAR(128) NOT NULL,
  purchase_responsible_snapshot VARCHAR(128) NOT NULL,
  plan_remark_snapshot VARCHAR(1000) NULL,
  stock_material_id_snapshot BIGINT NULL,
  purchase_qty NUMERIC(18, 1) NOT NULL,
  status VARCHAR(128) NOT NULL DEFAULT '已申购',
  usage VARCHAR(500) NOT NULL,
  usage_hash VARCHAR(32) NOT NULL,
  subitem_no VARCHAR(64) NULL,
  trace_no VARCHAR(128) NULL,
  salesperson VARCHAR(128) NULL,
  contract_sign_date DATE NULL,
  unit_price NUMERIC(18, 2) NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_purchase_request_line PRIMARY KEY (id),
  CONSTRAINT ck_purchase_request_line_purchase_positive CHECK (purchase_qty > 0),
  CONSTRAINT uq_purchase_request_line_purchase_request_id
    UNIQUE (purchase_request_id, purchase_material_id, subitem_no, usage_hash),
  CONSTRAINT fk_purchase_request_line_purchase_request_id_purchase_request
    FOREIGN KEY (purchase_request_id) REFERENCES purchase_request (id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_request_line_purchase_material_id_purchase_material
    FOREIGN KEY (purchase_material_id) REFERENCES purchase_material (id) ON DELETE SET NULL,
  CONSTRAINT fk_purchase_request_line_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_purchase_request_line_trace_no ON purchase_request_line (trace_no);
CREATE INDEX IF NOT EXISTS ix_purchase_request_line_project_id
  ON purchase_request_line (project_id);
-- 申购计划「是否已转入申购记录」的 EXISTS / NOT EXISTS 判定（计划列表、筛选项、小程序计划列表）按它反查；
-- 唯一键以 purchase_request_id 开头，用不上。
CREATE INDEX IF NOT EXISTS ix_purchase_request_line_purchase_material_id
  ON purchase_request_line (purchase_material_id);
-- 工作台「在途申购」计数与按状态筛选。
CREATE INDEX IF NOT EXISTS ix_purchase_request_line_project_status
  ON purchase_request_line (project_id, status);

CREATE TABLE IF NOT EXISTS purchase_request_line_image (
  line_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  file_id VARCHAR(36) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT pk_purchase_request_line_image PRIMARY KEY (line_id, file_id),
  CONSTRAINT fk_purchase_request_line_image_line_id_purchase_request_line
    FOREIGN KEY (line_id) REFERENCES purchase_request_line (id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_request_line_image_file_id_file_object
    FOREIGN KEY (file_id) REFERENCES file_object (id),
  CONSTRAINT fk_purchase_request_line_image_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_purchase_request_line_image_project_id
  ON purchase_request_line_image (project_id);
-- 附件引用计数、悬空清理与删除前预检都按 file_id 反查（主键以 owner_id 开头用不上）。
CREATE INDEX IF NOT EXISTS ix_purchase_request_line_image_file_id ON purchase_request_line_image (file_id);

CREATE TABLE IF NOT EXISTS stock_operation_line (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  operation_id BIGINT NOT NULL,
  stock_material_id BIGINT NOT NULL,
  quantity NUMERIC(18, 1) NOT NULL,
  remaining_qty NUMERIC(18, 1) NOT NULL,
  before_qty NUMERIC(18, 1) NOT NULL,
  after_qty NUMERIC(18, 1) NOT NULL,
  material_name_snapshot VARCHAR(128) NOT NULL,
  model_spec_snapshot VARCHAR(255) NOT NULL,
  unit_name_snapshot VARCHAR(32) NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_stock_operation_line PRIMARY KEY (id),
  CONSTRAINT ck_stock_operation_line_operation_quantity_positive CHECK (quantity > 0),
  CONSTRAINT uq_stock_operation_line_operation_id UNIQUE (operation_id, stock_material_id),
  CONSTRAINT fk_stock_operation_line_operation_id_stock_operation
    FOREIGN KEY (operation_id) REFERENCES stock_operation (id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_operation_line_stock_material_id_stock_material
    FOREIGN KEY (stock_material_id) REFERENCES stock_material (id),
  CONSTRAINT fk_stock_operation_line_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_operation_line_material_operation
  ON stock_operation_line (stock_material_id, operation_id);
CREATE INDEX IF NOT EXISTS ix_stock_operation_line_project_id
  ON stock_operation_line (project_id);

CREATE TABLE IF NOT EXISTS memo (
  id BIGSERIAL NOT NULL,
  title VARCHAR(64) NOT NULL DEFAULT '未命名备忘录',
  content TEXT NOT NULL DEFAULT '',
  created_by BIGINT NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_memo PRIMARY KEY (id),
  CONSTRAINT fk_memo_created_by_user
    FOREIGN KEY (created_by) REFERENCES app_user (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_memo_created_by ON memo (created_by);

-- 隐患管理：责任单位 / 隐患类型两张字典表 + 隐患台账主表 + 整改前/后两张图片关联表。
-- 隐患与两张字典表均为物理删除（删除前校验引用），图片关联表随隐患级联删除。

CREATE TABLE IF NOT EXISTS hazard_unit (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  name VARCHAR(128) NOT NULL,
  person VARCHAR(64) NOT NULL,
  remark VARCHAR(255) NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_hazard_unit PRIMARY KEY (id),
  CONSTRAINT uq_hazard_unit_project_name UNIQUE (project_id, name),
  CONSTRAINT fk_hazard_unit_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_hazard_unit_project_id ON hazard_unit (project_id);

CREATE TABLE IF NOT EXISTS hazard_type (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  major VARCHAR(128) NOT NULL,
  minor VARCHAR(128) NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_hazard_type PRIMARY KEY (id),
  CONSTRAINT uq_hazard_type_project_major UNIQUE (project_id, major, minor),
  CONSTRAINT fk_hazard_type_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_hazard_type_project_id ON hazard_type (project_id);

CREATE TABLE IF NOT EXISTS hazard (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  inspection_area VARCHAR(128) NOT NULL DEFAULT '华星现场',
  inspection_date DATE NOT NULL,
  inspector VARCHAR(64) NOT NULL DEFAULT '电气自查',
  description TEXT NOT NULL,
  suggestion TEXT NULL,
  hazard_unit_id BIGINT NOT NULL,
  person VARCHAR(64) NOT NULL DEFAULT '',
  due_date DATE NOT NULL,
  recheck_person VARCHAR(64) NULL,
  rectify_person VARCHAR(64) NULL,
  status hazardstatus NOT NULL DEFAULT 'PENDING',
  hazard_type_id BIGINT NOT NULL,
  level hazardlevel NOT NULL DEFAULT 'GENERAL',
  remark TEXT NULL,
  client_request_id VARCHAR(64) NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_hazard PRIMARY KEY (id),
  CONSTRAINT uq_hazard_project_client_request_id UNIQUE (project_id, client_request_id),
  CONSTRAINT fk_hazard_hazard_unit_id_hazard_unit
    FOREIGN KEY (hazard_unit_id) REFERENCES hazard_unit (id),
  CONSTRAINT fk_hazard_hazard_type_id_hazard_type
    FOREIGN KEY (hazard_type_id) REFERENCES hazard_type (id),
  CONSTRAINT fk_hazard_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_hazard_unit_id ON hazard (hazard_unit_id);
CREATE INDEX IF NOT EXISTS ix_hazard_type_id ON hazard (hazard_type_id);
CREATE INDEX IF NOT EXISTS ix_hazard_project_status ON hazard (project_id, status);
-- 隐患台账默认排序（登记时间倒序）分页。
CREATE INDEX IF NOT EXISTS ix_hazard_project_created ON hazard (project_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_hazard_due_date ON hazard (due_date);
CREATE INDEX IF NOT EXISTS ix_hazard_project_id ON hazard (project_id);

CREATE TABLE IF NOT EXISTS hazard_before_image (
  hazard_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  file_id VARCHAR(36) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT pk_hazard_before_image PRIMARY KEY (hazard_id, file_id),
  CONSTRAINT fk_hazard_before_image_hazard_id_hazard
    FOREIGN KEY (hazard_id) REFERENCES hazard (id) ON DELETE CASCADE,
  CONSTRAINT fk_hazard_before_image_file_id_file_object
    FOREIGN KEY (file_id) REFERENCES file_object (id),
  CONSTRAINT fk_hazard_before_image_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_hazard_before_image_project_id
  ON hazard_before_image (project_id);
-- 附件引用计数、悬空清理与删除前预检都按 file_id 反查（主键以 owner_id 开头用不上）。
CREATE INDEX IF NOT EXISTS ix_hazard_before_image_file_id ON hazard_before_image (file_id);

CREATE TABLE IF NOT EXISTS hazard_after_image (
  hazard_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  file_id VARCHAR(36) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT pk_hazard_after_image PRIMARY KEY (hazard_id, file_id),
  CONSTRAINT fk_hazard_after_image_hazard_id_hazard
    FOREIGN KEY (hazard_id) REFERENCES hazard (id) ON DELETE CASCADE,
  CONSTRAINT fk_hazard_after_image_file_id_file_object
    FOREIGN KEY (file_id) REFERENCES file_object (id),
  CONSTRAINT fk_hazard_after_image_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_hazard_after_image_project_id
  ON hazard_after_image (project_id);
-- 附件引用计数、悬空清理与删除前预检都按 file_id 反查（主键以 owner_id 开头用不上）。
CREATE INDEX IF NOT EXISTS ix_hazard_after_image_file_id ON hazard_after_image (file_id);

-- 台账管理：标签节点（自引用邻接表，至多 3 层）+ 标签图片关联 + 台账记录 + 台账图片关联。
-- 台账记录的标签以英文逗号分隔的标签 id 存在 ledger.tag_ids（如 '3,12,15'，空串代表未挂标签），
-- 由服务端规范化写入（去重、升序、无空格）。层级上限、同级名称唯一、被引用/有子节点不可删除
-- 都写在服务端：外键只保证父节点存在，唯一索引对 NULL 不去重（默认 NULLS DISTINCT），
-- 覆盖不到根节点。

CREATE TABLE IF NOT EXISTS ledger_tag (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  parent_id BIGINT NULL,
  name VARCHAR(128) NOT NULL,
  remark VARCHAR(500) NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_ledger_tag PRIMARY KEY (id),
  CONSTRAINT fk_ledger_tag_parent_id_ledger_tag
    FOREIGN KEY (parent_id) REFERENCES ledger_tag (id),
  CONSTRAINT fk_ledger_tag_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_ledger_tag_parent_id ON ledger_tag (parent_id);
CREATE INDEX IF NOT EXISTS ix_ledger_tag_project_id ON ledger_tag (project_id);

CREATE TABLE IF NOT EXISTS ledger_tag_image (
  tag_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  file_id VARCHAR(36) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT pk_ledger_tag_image PRIMARY KEY (tag_id, file_id),
  CONSTRAINT fk_ledger_tag_image_tag_id_ledger_tag
    FOREIGN KEY (tag_id) REFERENCES ledger_tag (id) ON DELETE CASCADE,
  CONSTRAINT fk_ledger_tag_image_file_id_file_object
    FOREIGN KEY (file_id) REFERENCES file_object (id),
  CONSTRAINT fk_ledger_tag_image_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_ledger_tag_image_project_id ON ledger_tag_image (project_id);
-- 附件引用计数、悬空清理与删除前预检都按 file_id 反查（主键以 owner_id 开头用不上）。
CREATE INDEX IF NOT EXISTS ix_ledger_tag_image_file_id ON ledger_tag_image (file_id);

CREATE TABLE IF NOT EXISTS ledger (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  name VARCHAR(128) NOT NULL,
  model_spec VARCHAR(255) NOT NULL,
  subitem_no VARCHAR(64) NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_name VARCHAR(32) NOT NULL,
  usage VARCHAR(500) NOT NULL,
  remark VARCHAR(1000) NULL,
  tag_ids VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_ledger PRIMARY KEY (id),
  CONSTRAINT fk_ledger_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_ledger_project_id ON ledger (project_id);
-- 台账总览默认排序（创建时间倒序）分页。
CREATE INDEX IF NOT EXISTS ix_ledger_project_created ON ledger (project_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS ledger_image (
  ledger_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  file_id VARCHAR(36) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT pk_ledger_image PRIMARY KEY (ledger_id, file_id),
  CONSTRAINT fk_ledger_image_ledger_id_ledger
    FOREIGN KEY (ledger_id) REFERENCES ledger (id) ON DELETE CASCADE,
  CONSTRAINT fk_ledger_image_file_id_file_object
    FOREIGN KEY (file_id) REFERENCES file_object (id),
  CONSTRAINT fk_ledger_image_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_ledger_image_project_id ON ledger_image (project_id);
-- 附件引用计数、悬空清理与删除前预检都按 file_id 反查（主键以 owner_id 开头用不上）。
CREATE INDEX IF NOT EXISTS ix_ledger_image_file_id ON ledger_image (file_id);

-- 工作管理：任务（活）+ 任务图片 + 工作记录（谁在什么时候干哪个活）。
-- 任务名在项目内唯一：同一件活反复干都登记在同一个任务下，用工作记录的起止时间表达周期，
-- 任务视图因此能看到它的全周期；状态是人工维护的进度标记，不随计划或记录自动流转。
CREATE TABLE IF NOT EXISTS work_task (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  name VARCHAR(128) NOT NULL,
  description VARCHAR(1000) NULL,
  status worktaskstatus NOT NULL DEFAULT 'PENDING',
  plan_start_date DATE NULL,
  plan_end_date DATE NULL,
  remark VARCHAR(500) NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_work_task PRIMARY KEY (id),
  CONSTRAINT uq_work_task_project_name UNIQUE (project_id, name),
  CONSTRAINT fk_work_task_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_work_task_project_status ON work_task (project_id, status);
CREATE INDEX IF NOT EXISTS ix_work_task_project_id ON work_task (project_id);

CREATE TABLE IF NOT EXISTS work_task_image (
  task_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  file_id VARCHAR(36) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT pk_work_task_image PRIMARY KEY (task_id, file_id),
  CONSTRAINT fk_work_task_image_task_id_work_task
    FOREIGN KEY (task_id) REFERENCES work_task (id) ON DELETE CASCADE,
  CONSTRAINT fk_work_task_image_file_id_file_object
    FOREIGN KEY (file_id) REFERENCES file_object (id),
  CONSTRAINT fk_work_task_image_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_work_task_image_project_id ON work_task_image (project_id);
-- 附件引用计数、悬空清理与删除前预检都按 file_id 反查（主键以 owner_id 开头用不上）。
CREATE INDEX IF NOT EXISTS ix_work_task_image_file_id ON work_task_image (file_id);

-- 工作记录：起止都精确到上午（AM）/ 下午（PM）；参与人员是「、」连接的姓名串
-- （最多 20 人 × 24 字（含分隔符）= 500 字符，正好等于列宽），人员视图按姓名拆分后分组。
-- 半日占用判定与「结束不早于开始」都由服务端校验，库里不加 CHECK，规则只有一处实现。
CREATE TABLE IF NOT EXISTS work_record (
  id BIGSERIAL NOT NULL,
  project_id BIGINT NOT NULL,
  task_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  start_half workhalfday NOT NULL,
  end_date DATE NOT NULL,
  end_half workhalfday NOT NULL,
  participants VARCHAR(500) NOT NULL,
  remark VARCHAR(500) NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_work_record PRIMARY KEY (id),
  CONSTRAINT fk_work_record_task_id_work_task
    FOREIGN KEY (task_id) REFERENCES work_task (id),
  CONSTRAINT fk_work_record_project_id_project
    FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS ix_work_record_task_id ON work_record (task_id);
CREATE INDEX IF NOT EXISTS ix_work_record_start_date ON work_record (start_date);
CREATE INDEX IF NOT EXISTS ix_work_record_project_id ON work_record (project_id);

-- 默认项目（首次导入的既有数据都归它）。重复导入不改变已有项目的启用状态。
INSERT INTO project (name, enabled, is_default, remark)
VALUES ('华星现有项目', TRUE, TRUE, '系统初始项目')
ON CONFLICT (name) DO UPDATE SET is_default = EXCLUDED.is_default;

-- 隐患类型字典（大类 + 小类两级；源自旧隐患系统，共 157 条 / 16 个大类）。
-- 重复导入不改变已有行，仅按 (project_id, major, minor) 唯一键跳过。
INSERT INTO hazard_type (project_id, major, minor)
SELECT p.id, v.major, v.minor
FROM project p
CROSS JOIN (VALUES
  ('个人防护用品', '个体劳动防护用品、用具未使用或未能正确使用'),
  ('个人防护用品', '劳动防护用品用具缺乏或有缺陷'),
  ('个人防护用品', '防护用品维护、更换不及时'),
  ('个人防护用品', '防护用品选型不匹配'),
  ('交通安全', '交通安全管理缺陷，如未进行设备点检、车辆维护保养缺失或不足等'),
  ('交通安全', '交通安全行为不规范，如超速、不按规定路线行驶等'),
  ('交通安全', '交通标志、信号、道路标线缺陷'),
  ('交通安全', '交通环境不良、路面滑、不平、道路排水不良、能见度差等'),
  ('交通安全', '交通设备机具缺陷，如：轮胎磨损严重、制动系统故障等'),
  ('交通安全', '叉车、工程车辆管理缺陷'),
  ('交通安全', '夜间行车安全措施不足'),
  ('交通安全', '驾驶人员无证或违规驾驶'),
  ('人的不安全行为', '不佩戴或错误使用劳动防护用品'),
  ('人的不安全行为', '不安全的行为习惯'),
  ('人的不安全行为', '作业未设专人监护或违章指挥'),
  ('人的不安全行为', '侥幸心理、冒险行为'),
  ('人的不安全行为', '冒险进入危险区域、场所'),
  ('人的不安全行为', '对易燃、易爆等危险物品处理错误'),
  ('人的不安全行为', '心理、生理状况异常'),
  ('人的不安全行为', '擅自改变工艺或操作方式'),
  ('人的不安全行为', '攀爬、坐、站立不安全位置'),
  ('人的不安全行为', '有分散注意力行为'),
  ('人的不安全行为', '未持证上岗'),
  ('人的不安全行为', '物料、物体堆、存放不当'),
  ('人的不安全行为', '误操作、忽视安全、忽视警告'),
  ('人的不安全行为', '违反劳动纪律'),
  ('人的不安全行为', '违章作业'),
  ('人的不安全行为', '违章指挥'),
  ('人的不安全行为', '违规使用工器具和设备'),
  ('作业环境因素', '作业场地安全通道、出口缺陷'),
  ('作业环境因素', '其他作业环境不良（如：强迫体位、综合性作业环境不良）'),
  ('作业环境因素', '室内作业场所环境不良（如地面滑、地面不平、采光照明不良、空气不良、场地杂乱等）'),
  ('作业环境因素', '室外作业场所环境不良（如恶劣的气候与环境、作业场地狭窄、杂乱、地面不平等）'),
  ('作业环境因素', '建(构)筑物和其他结构缺陷'),
  ('作业环境因素', '气体聚集、缺氧风险'),
  ('作业环境因素', '职业卫生类'),
  ('作业环境因素', '运动物危害'),
  ('其他管理缺陷', '作业人员资质不符合要求'),
  ('其他管理缺陷', '安全操作规程、不健全、缺失'),
  ('其他管理缺陷', '安全生产管理制度、不健全、缺失'),
  ('其他管理缺陷', '安全生产管理档案资料丢失、未按规定存档'),
  ('其他管理缺陷', '安全管理人员配备不足、未成立机构等'),
  ('其他管理缺陷', '应急预案体系不健全、预案不规范、演练不规范、应急物资配备不全、保存不当'),
  ('其他管理缺陷', '教育培训不到位、培训计划不适用、培训效果不达标等'),
  ('其他管理缺陷', '未建立台账、事故原因分析不全面/不深入、整改没有有效落实四不放过原则'),
  ('其他管理缺陷', '未落实相关EHS职责'),
  ('其他管理缺陷', '隐患整改资金未落实'),
  ('其他管理缺陷', '隐患整改闭环不到位'),
  ('危险化学品安全', '危化品台账不完善'),
  ('危险化学品安全', '危化品泄漏、跑冒滴漏'),
  ('危险化学品安全', '危险化学品使用不规范：使用易燃易爆物品作业时附近有明火'),
  ('危险化学品安全', '危险化学品存储不合规或不规范'),
  ('危险化学品安全', '危险化学品应急管理缺陷'),
  ('危险化学品安全', '危险化学品未定期检查、巡检不到位'),
  ('危险化学品安全', '危险化学品管理缺陷，如没有MSDS、容器缺少标签、安全标志不全或缺失、未建立台账等'),
  ('危险化学品安全', '危险化学品运输机具或设备、工器具、附件类缺陷'),
  ('安全警示和安全标识', '临时作业警示标识不到位'),
  ('安全警示和安全标识', '危险区域无禁止标识'),
  ('安全警示和安全标识', '安全色、警示线设置不规范'),
  ('安全警示和安全标识', '安全警示标识损坏、模糊'),
  ('安全警示和安全标识', '安全警示标识缺失'),
  ('安全警示和安全标识', '禁令、指令标识不规范'),
  ('安全警示和安全标识', '警示标识设置位置不合理'),
  ('安全警示和安全标识', '风险告知标识缺失'),
  ('建设施工安全', '临时楼梯、平台、护栏、跳板等搭设有缺陷或不规范'),
  ('建设施工安全', '交叉作业安全措施不足'),
  ('建设施工安全', '其他施工作业不规范'),
  ('建设施工安全', '吊篮作业不规范'),
  ('建设施工安全', '土石方作业不规范'),
  ('建设施工安全', '基坑、高处、孔洞、临边无防护或防护不足'),
  ('建设施工安全', '施工人员安全培训不足'),
  ('建设施工安全', '施工用电、用火不规范'),
  ('建设施工安全', '模板工程不规范'),
  ('建设施工安全', '脚手架搭设不规范或有缺陷'),
  ('建设施工安全', '边坡作业不规范'),
  ('文明施工', '其他不符合文明施工的问题'),
  ('文明施工', '未做好工完料净场地清'),
  ('文明施工', '材料、设备、预制件等物品堆放不规范'),
  ('文明施工', '现场的建筑垃圾未及时清理'),
  ('文明施工', '现场的生活垃圾乱扔、乱堆、未及时处理等'),
  ('消防安全', '不符合管理要求'),
  ('消防安全', '易燃易爆区域不合规或作业不规范'),
  ('消防安全', '易燃易爆物品管理不规范'),
  ('消防安全', '消防器材、物资存放不当'),
  ('消防安全', '消防档案资料缺失或管理不当'),
  ('消防安全', '消防设施、设备未定期维护或维保不足'),
  ('消防安全', '消防设施、设备缺陷'),
  ('消防安全', '消防设施配置不足'),
  ('消防安全', '消防通道、疏散通道不畅'),
  ('消防安全', '火灾风险辨识不到位'),
  ('特种设备安全', '操作人员无证或证件过期'),
  ('特种设备安全', '日常检查、维护不到位'),
  ('特种设备安全', '特种设备、附件缺陷'),
  ('特种设备安全', '特种设备使用环境缺陷'),
  ('特种设备安全', '特种设备操作行为不规范'),
  ('特种设备安全', '特种设备管理缺陷'),
  ('特种设备安全', '起重吊具、索具不合格'),
  ('环保', '危废暂存、转运不规范'),
  ('环保', '危废管理处置'),
  ('环保', '大气污染'),
  ('环保', '工业垃圾处置'),
  ('环保', '水污染'),
  ('环保', '漏料、撒料'),
  ('环保', '环保台账记录不完整'),
  ('环保', '环保设备、设施维护不到位、运行异常'),
  ('环保', '生活垃圾处置'),
  ('环保', '能源、材料、资源浪费'),
  ('环保', '跑冒滴漏污染环境'),
  ('现场5S', '整理'),
  ('现场5S', '整顿'),
  ('现场5S', '清扫'),
  ('现场5S', '清洁'),
  ('现场5S', '素养'),
  ('生产设备设施安全', '急停、拉绳装置失效'),
  ('生产设备设施安全', '护栏、平台、梯台等防护缺陷'),
  ('生产设备设施安全', '检修状态防护不到位'),
  ('生产设备设施安全', '联锁、保护装置失效'),
  ('生产设备设施安全', '设备在非正常环境状态下运行，如：恶劣环境、灰尘超标、腐蚀性环境等'),
  ('生产设备设施安全', '设备未定期检查、检查记录不规范'),
  ('生产设备设施安全', '设备设施、工具、附件有缺陷'),
  ('生产设备设施安全', '设备设施标志缺陷'),
  ('生产设备设施安全', '设备设施管理类，如：未建立台账、验收不规范、保养检维修不到位等'),
  ('生产设备设施安全', '设备设施防护缺陷'),
  ('生产设备设施安全', '转动、传动部位防护不到位'),
  ('电气安全', '低压操作行为不合规、不规范'),
  ('电气安全', '低压电气设备设施缺陷'),
  ('电气安全', '低压配电系统缺陷'),
  ('电气安全', '升压系统类，如：变压器、断路器、隔离开关、电容器、电抗器、自动调压装置和保护装置缺陷等'),
  ('电气安全', '变电站系统，如变压器、断路器、隔离开关、接地开关、继电器保护装置、无功补偿设备等缺陷'),
  ('电气安全', '带电作业不规范'),
  ('电气安全', '带电部位防护不到位'),
  ('电气安全', '接地、接零不符合要求'),
  ('电气安全', '涉爆区域电气安全隐患'),
  ('电气安全', '漏电保护装置缺失或失效'),
  ('电气安全', '电气管理缺陷，如两票三制、档案资料、工器具缺陷等'),
  ('电气安全', '电缆敷设不规范'),
  ('电气安全', '配电设施设置不规范'),
  ('电气安全', '高中压配电系统缺陷'),
  ('电气安全', '高压操作类行为不规范'),
  ('电气安全', '高压输电系统缺陷'),
  ('高风险作业安全', '临时用电作业不规范'),
  ('高风险作业安全', '作业JSA分析不到位、安全技术交底不到位'),
  ('高风险作业安全', '作业安全监护未落实或未有效落实'),
  ('高风险作业安全', '作业未按要求执行作业票管理程序进行签票'),
  ('高风险作业安全', '作业票填写不规范、有修改涂抹、相关人员未签字、未进行闭环管理等'),
  ('高风险作业安全', '其他作业不规范（如：非常规类授权类作业）'),
  ('高风险作业安全', '动土作业不规范'),
  ('高风险作业安全', '动火作业不规范'),
  ('高风险作业安全', '占道或断路作业不规范'),
  ('高风险作业安全', '危险作业人员不符合要求（如未持证、身体条件不符合、能力不具备等）'),
  ('高风险作业安全', '危险性较大设备设施检维修作业不规范'),
  ('高风险作业安全', '受限空间作业不规范'),
  ('高风险作业安全', '吊装作业不规范'),
  ('高风险作业安全', '带电作业管理缺陷'),
  ('高风险作业安全', '挂牌上锁作业不规范'),
  ('高风险作业安全', '检修作业安全措施不到位'),
  ('高风险作业安全', '高处作业不规范')
) AS v(major, minor)
WHERE p.is_default = TRUE
ON CONFLICT (project_id, major, minor) DO NOTHING;

-- 首次登录账号，默认密码均为 123456。重复导入不会重置已有账号密码与权限位。
-- 权限位（BIGINT）：bit0 系统管理、bit1-2 二级库读写、bit3-4 申购读写、bit5 华星只读、bit6 编码库只读、
-- bit6 退役（原编码库只读，已并入申购）、bit7-8 台账读写、bit9-10 隐患读写、bit11-12 工单读写；全开 = 8127。
-- API 令牌用 gen_random_uuid() 生成（32 位十六进制 + 连字符），只保存 SHA-256 哈希。
INSERT INTO app_user (username, password_hash, api_token_hash, display_name, department_name, permissions, enabled)
VALUES
  ('admin', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '系统管理员', '华星检修维护部电气车间', 32703, TRUE),
  ('warehouse', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '仓库管理员', '华星检修维护部电气车间', 24582, TRUE),
  ('purchase', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '申购管理员', '华星检修维护部电气车间', 24, TRUE),
  ('hazard', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '隐患管理员', '华星检修维护部电气车间', 1536, TRUE),
  ('ledger', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '台账管理员', '华星检修维护部电气车间', 384, TRUE),
  ('work', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '工作管理员', '华星检修维护部电气车间', 6144, TRUE),
  ('readonly', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '只读用户', '华星检修维护部电气车间', 10922, TRUE)
ON CONFLICT (username) DO UPDATE
SET display_name = EXCLUDED.display_name,
    department_name = EXCLUDED.department_name,
    enabled = EXCLUDED.enabled;

-- ============================================================================
-- 表注释与字段注释：结构变更后同步维护（COMMENT ON 幂等，可重复执行）。
-- 命名约定：表名 / 列名统一 snake_case 小写；主键 id（BIGSERIAL）+ created_at / updated_at /
-- version（乐观锁）为通用审计列；项目域表带 project_id。保留字表名统一加前缀（如 app_user）。
-- ============================================================================
COMMENT ON TABLE project IS '项目（业务数据隔离维度，全局表）';
COMMENT ON COLUMN project."id" IS '主键，自增';
COMMENT ON COLUMN project."name" IS '项目名称，唯一';
COMMENT ON COLUMN project."enabled" IS '是否启用（停用后不可选 / 不可写入）';
COMMENT ON COLUMN project."is_default" IS '是否默认项目（唯一，小程序 / MCP 未指定项目时兜底）';
COMMENT ON COLUMN project."remark" IS '备注';
COMMENT ON COLUMN project."created_at" IS '创建时间';
COMMENT ON COLUMN project."updated_at" IS '更新时间';
COMMENT ON COLUMN project."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON TABLE app_user IS '统一用户（网页端 + 小程序端共用，微信 openid 直存；权限位图直接落 permissions）';
COMMENT ON COLUMN app_user."id" IS '主键';
COMMENT ON COLUMN app_user."username" IS '登录名，唯一（小程序来源用户由 openid 派生 `wx_<hash>`）';
COMMENT ON COLUMN app_user."password_hash" IS 'Argon2id 密码哈希（小程序来源用户为空串，不可密码登录）';
COMMENT ON COLUMN app_user."api_token_hash" IS '接口令牌 SHA-256，非空值唯一（部分唯一索引，小程序用户为空串），用于认证查找';
COMMENT ON COLUMN app_user."api_token_enc" IS '接口令牌 Fernet 密文，供读取接口解密回显';
COMMENT ON COLUMN app_user."display_name" IS '显示名称';
COMMENT ON COLUMN app_user."department_name" IS '部门单位';
COMMENT ON COLUMN app_user."wechat_openid" IS '微信 OpenID（仅小程序来源用户；非空时唯一，一个小程序一个 openid）';
COMMENT ON COLUMN app_user."permissions" IS '权限位图（BIGINT，按位判断）；bit0 系统管理、各功能读写位见 domain.PermissionCatalog';
COMMENT ON COLUMN app_user."enabled" IS '账号是否启用';
COMMENT ON COLUMN app_user."last_used_at" IS '最近登录时间（网页密码登录与小程序登录均刷新，不自增 version）';
COMMENT ON COLUMN app_user."created_at" IS '创建时间';
COMMENT ON COLUMN app_user."updated_at" IS '更新时间';
COMMENT ON COLUMN app_user."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON TABLE business_event_log IS '业务事件日志（状态流转与数据快照）';
COMMENT ON COLUMN business_event_log."id" IS '主键';
COMMENT ON COLUMN business_event_log."business_type" IS '业务类型标识';
COMMENT ON COLUMN business_event_log."business_id" IS '业务主键（弱关联，无外键）';
COMMENT ON COLUMN business_event_log."action" IS '动作标识';
COMMENT ON COLUMN business_event_log."old_status" IS '变更前状态';
COMMENT ON COLUMN business_event_log."new_status" IS '变更后状态';
COMMENT ON COLUMN business_event_log."occurred_at" IS '事件发生时间';
COMMENT ON COLUMN business_event_log."remark" IS '备注';
COMMENT ON COLUMN business_event_log."before_data" IS '变更前数据快照';
COMMENT ON COLUMN business_event_log."after_data" IS '变更后数据快照';
COMMENT ON TABLE system_setting IS '系统设置键值表';
COMMENT ON COLUMN system_setting."setting_key" IS '设置键，主键';
COMMENT ON COLUMN system_setting."setting_value" IS '设置值（JSON 文档）';
COMMENT ON COLUMN system_setting."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON COLUMN system_setting."updated_at" IS '更新时间';
COMMENT ON TABLE webhook_delivery IS 'Webhook 投递记录与重试状态（渠道地址 / 订阅事件来自服务端环境变量）';
COMMENT ON COLUMN webhook_delivery."id" IS '主键';
COMMENT ON COLUMN webhook_delivery."event_id" IS '事件 id（与 `platform` 组合唯一，幂等）';
COMMENT ON COLUMN webhook_delivery."event_type" IS '事件类型，接口值为 `stock.outbound.created` / `stock.inbound.created` / `mini_program.user.bound`';
COMMENT ON COLUMN webhook_delivery."platform" IS '目标平台（FEISHU / DINGTALK），地址与密钥来自环境变量';
COMMENT ON COLUMN webhook_delivery."payload" IS '投递报文';
COMMENT ON COLUMN webhook_delivery."status" IS '投递状态';
COMMENT ON COLUMN webhook_delivery."attempts" IS '已尝试次数';
COMMENT ON COLUMN webhook_delivery."next_retry_at" IS '下次重试时间';
COMMENT ON COLUMN webhook_delivery."response_status" IS '响应 HTTP 状态码';
COMMENT ON COLUMN webhook_delivery."response_excerpt" IS '响应摘录';
COMMENT ON COLUMN webhook_delivery."last_error" IS '最近错误信息';
COMMENT ON COLUMN webhook_delivery."created_at" IS '创建时间';
COMMENT ON COLUMN webhook_delivery."updated_at" IS '更新时间';
COMMENT ON COLUMN webhook_delivery."delivered_at" IS '投递成功时间';
COMMENT ON TABLE file_object IS '文件对象元数据（图片等）';
COMMENT ON COLUMN file_object."id" IS '主键，UUID 字符串（`uuid7_string`）';
COMMENT ON COLUMN file_object."original_name" IS '原始文件名';
COMMENT ON COLUMN file_object."mime_type" IS 'MIME 类型';
COMMENT ON COLUMN file_object."size_bytes" IS '文件字节数';
COMMENT ON COLUMN file_object."width" IS '图片宽度';
COMMENT ON COLUMN file_object."height" IS '图片高度';
COMMENT ON COLUMN file_object."sha256" IS '内容哈希（非唯一索引）';
COMMENT ON COLUMN file_object."source_sha256" IS '原始上传字节（重编码成 PNG 之前）的 SHA-256，供网页端「先提交摘要比对、命中免上传」查找；老数据与不超过 1MB 的图片为空，空值表示不参与前端查重';
COMMENT ON COLUMN file_object."source_probes" IS '中间片段挑战材料 `{"size": 原始字节数, "windows": [{"offset", "length", "sha256"}, …]}`：查重命中时服务端随机取一个窗口返回，客户端对本地同位置字节算出同样的摘要即证明持有相同文件；只留摘要不留原文';
COMMENT ON COLUMN file_object."created_at" IS '创建时间';
COMMENT ON COLUMN file_object."updated_at" IS '更新时间';
COMMENT ON COLUMN file_object."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON COLUMN file_object."deleted_at" IS '软删除时间；非空表示待删除：保留 7 个完整自然日，到期后的第一个凌晨 2 点复查引用仍无引用才物理清除（保留期内可撤销）';
COMMENT ON TABLE material_code_library IS '物资编码库（编码 / 名称 / 型号对照）';
COMMENT ON COLUMN material_code_library."id" IS '主键';
COMMENT ON COLUMN material_code_library."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN material_code_library."material_code" IS '物资编码，项目内唯一';
COMMENT ON COLUMN material_code_library."name" IS '名称';
COMMENT ON COLUMN material_code_library."model_spec" IS '型号规格';
COMMENT ON COLUMN material_code_library."unit_name" IS '单位';
COMMENT ON COLUMN material_code_library."created_at" IS '创建时间';
COMMENT ON TABLE material_price IS '物料价格（货品编码 → 物料编码 + 全成本单价-人民币）';
COMMENT ON COLUMN material_price."id" IS '主键';
COMMENT ON COLUMN material_price."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN material_price."material_code" IS '物料编码（价格表的「货品编码」），项目内唯一';
COMMENT ON COLUMN material_price."unit_price" IS '全成本单价-人民币；没有价格的行导入时跳过，因此不会存 NULL';
COMMENT ON COLUMN material_price."created_at" IS '创建时间';
COMMENT ON TABLE excel_import_job IS 'Excel 导入任务';
COMMENT ON COLUMN excel_import_job."id" IS '主键';
COMMENT ON COLUMN excel_import_job."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN excel_import_job."import_type" IS '导入类型标识';
COMMENT ON COLUMN excel_import_job."status" IS '任务状态';
COMMENT ON COLUMN excel_import_job."original_filename" IS '上传文件名';
COMMENT ON COLUMN excel_import_job."file_path" IS '上传文件落盘路径';
COMMENT ON COLUMN excel_import_job."result" IS '导入结果统计';
COMMENT ON COLUMN excel_import_job."error_code" IS '错误码';
COMMENT ON COLUMN excel_import_job."error_message" IS '错误信息';
COMMENT ON COLUMN excel_import_job."created_by" IS '创建人';
COMMENT ON COLUMN excel_import_job."created_at" IS '创建时间';
COMMENT ON COLUMN excel_import_job."started_at" IS '开始执行时间';
COMMENT ON COLUMN excel_import_job."finished_at" IS '结束时间';
COMMENT ON COLUMN excel_import_job."updated_at" IS '更新时间';
COMMENT ON TABLE excel_export_job IS 'Excel 导出任务（`file_uuid` 为派生属性，无独立列）';
COMMENT ON COLUMN excel_export_job."id" IS '主键';
COMMENT ON COLUMN excel_export_job."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN excel_export_job."export_type" IS '导出类型标识';
COMMENT ON COLUMN excel_export_job."status" IS '任务状态';
COMMENT ON COLUMN excel_export_job."download_filename" IS '下载文件名';
COMMENT ON COLUMN excel_export_job."file_path" IS '生成文件路径（成功保留至保留期）';
COMMENT ON COLUMN excel_export_job."params" IS '导出参数快照';
COMMENT ON COLUMN excel_export_job."result" IS '导出结果统计';
COMMENT ON COLUMN excel_export_job."error_code" IS '错误码';
COMMENT ON COLUMN excel_export_job."error_message" IS '错误信息';
COMMENT ON COLUMN excel_export_job."created_by" IS '创建人';
COMMENT ON COLUMN excel_export_job."created_at" IS '创建时间';
COMMENT ON COLUMN excel_export_job."started_at" IS '开始执行时间';
COMMENT ON COLUMN excel_export_job."finished_at" IS '结束时间';
COMMENT ON COLUMN excel_export_job."updated_at" IS '更新时间';
COMMENT ON TABLE share_link IS '匿名分享链接';
COMMENT ON COLUMN share_link."id" IS '主键';
COMMENT ON COLUMN share_link."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN share_link."token" IS '分享令牌（UUID，唯一，不可猜解）';
COMMENT ON COLUMN share_link."share_type" IS '分享数据类型，接口值为 `purchase_plan` / `purchase_record`';
COMMENT ON COLUMN share_link."item_ids" IS '被分享数据行 id 数组（弱关联）';
COMMENT ON COLUMN share_link."columns" IS '展示列键名数组；NULL 表示全部默认列';
COMMENT ON COLUMN share_link."expires_at" IS '失效时间；NULL 表示永久有效';
COMMENT ON COLUMN share_link."created_by" IS '创建人';
COMMENT ON COLUMN share_link."created_at" IS '创建时间';
COMMENT ON COLUMN share_link."updated_at" IS '更新时间';
COMMENT ON TABLE huaxing_inventory IS '华兴库存（外部库存导入数据）';
COMMENT ON COLUMN huaxing_inventory."id" IS '主键';
COMMENT ON COLUMN huaxing_inventory."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN huaxing_inventory."first_inbound_date" IS '首次入库日期';
COMMENT ON COLUMN huaxing_inventory."warehouse" IS '仓库';
COMMENT ON COLUMN huaxing_inventory."material_code" IS '物资编码';
COMMENT ON COLUMN huaxing_inventory."name" IS '名称';
COMMENT ON COLUMN huaxing_inventory."model_spec" IS '型号规格';
COMMENT ON COLUMN huaxing_inventory."quantity" IS '数量（外部导入原始精度）';
COMMENT ON COLUMN huaxing_inventory."unit_name" IS '单位';
COMMENT ON COLUMN huaxing_inventory."purchaser" IS '申购人';
COMMENT ON COLUMN huaxing_inventory."purchase_department" IS '申购部门';
COMMENT ON COLUMN huaxing_inventory."subitem_no_name" IS '子项号名称';
COMMENT ON COLUMN huaxing_inventory."created_at" IS '创建时间';
COMMENT ON TABLE lite_inventory IS '精简二级库库存';
COMMENT ON COLUMN lite_inventory."id" IS '主键';
COMMENT ON COLUMN lite_inventory."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN lite_inventory."name" IS '名称';
COMMENT ON COLUMN lite_inventory."model_spec" IS '型号规格';
COMMENT ON COLUMN lite_inventory."unit_name" IS '单位';
COMMENT ON COLUMN lite_inventory."quantity" IS '数量（导入原始精度）';
COMMENT ON COLUMN lite_inventory."remark" IS '备注';
COMMENT ON COLUMN lite_inventory."created_at" IS '创建时间';
COMMENT ON TABLE purchase_request IS '申购记录头（订单 / 合同 / 船期等）';
COMMENT ON COLUMN purchase_request."id" IS '主键';
COMMENT ON COLUMN purchase_request."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN purchase_request."purchase_order_no" IS '采购订单号';
COMMENT ON COLUMN purchase_request."contract_no" IS '合同号';
COMMENT ON COLUMN purchase_request."vessel_no" IS '船号';
COMMENT ON COLUMN purchase_request."consolidation_date" IS '集港日期';
COMMENT ON COLUMN purchase_request."consolidation_port" IS '集港港口';
COMMENT ON COLUMN purchase_request."sailing_date" IS '开船日期';
COMMENT ON COLUMN purchase_request."remark" IS '备注';
COMMENT ON COLUMN purchase_request."purchase_date" IS '采购日期';
COMMENT ON COLUMN purchase_request."created_at" IS '创建时间';
COMMENT ON COLUMN purchase_request."updated_at" IS '更新时间';
COMMENT ON COLUMN purchase_request."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON TABLE stock_material IS '二级库物资';
COMMENT ON COLUMN stock_material."id" IS '主键';
COMMENT ON COLUMN stock_material."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN stock_material."uuid" IS '对外 UUID，唯一';
COMMENT ON COLUMN stock_material."name" IS '名称';
COMMENT ON COLUMN stock_material."name_id" IS '名称编号（别名索引）';
COMMENT ON COLUMN stock_material."alias" IS '别名';
COMMENT ON COLUMN stock_material."model_spec" IS '型号规格';
COMMENT ON COLUMN stock_material."unit_name" IS '单位';
COMMENT ON COLUMN stock_material."remark" IS '备注';
COMMENT ON COLUMN stock_material."identity_hash" IS '名称+型号+单位归一化哈希，唯一，用于去重';
COMMENT ON COLUMN stock_material."created_at" IS '创建时间';
COMMENT ON COLUMN stock_material."updated_at" IS '更新时间';
COMMENT ON COLUMN stock_material."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON TABLE stock_operation IS '出入库单据头';
COMMENT ON COLUMN stock_operation."id" IS '主键';
COMMENT ON COLUMN stock_operation."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN stock_operation."operation_no" IS '单据编号，项目内唯一';
COMMENT ON COLUMN stock_operation."operation_type" IS '出入库方向';
COMMENT ON COLUMN stock_operation."occurred_at" IS '业务发生时间（必填，无默认值）';
COMMENT ON COLUMN stock_operation."business_reason" IS '业务原因';
COMMENT ON COLUMN stock_operation."receiver_unit" IS '领用单位';
COMMENT ON COLUMN stock_operation."receiver_name" IS '领用人';
COMMENT ON COLUMN stock_operation."subitem_no" IS '子项号';
COMMENT ON COLUMN stock_operation."source_type" IS '来源：管理端/小程序/冲销/初始化';
COMMENT ON COLUMN stock_operation."reversal_of_id" IS '被冲销单据（自引用）';
COMMENT ON COLUMN stock_operation."client_request_id" IS '客户端请求 id，唯一，幂等键';
COMMENT ON COLUMN stock_operation."mini_program_user_name_snapshot" IS '小程序提交人姓名快照';
COMMENT ON COLUMN stock_operation."created_at" IS '创建时间';
COMMENT ON COLUMN stock_operation."updated_at" IS '更新时间';
COMMENT ON COLUMN stock_operation."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON TABLE purchase_material IS '申购计划物资行';
COMMENT ON COLUMN purchase_material."id" IS '主键';
COMMENT ON COLUMN purchase_material."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN purchase_material."plan_no" IS '计划编号，项目内唯一';
COMMENT ON COLUMN purchase_material."plan_date" IS '计划日期';
COMMENT ON COLUMN purchase_material."material_code" IS '物资编码；NULL 即未编码';
COMMENT ON COLUMN purchase_material."category" IS '分类';
COMMENT ON COLUMN purchase_material."urgency" IS '紧急程度';
COMMENT ON COLUMN purchase_material."demand_department" IS '需求部门';
COMMENT ON COLUMN purchase_material."name" IS '名称';
COMMENT ON COLUMN purchase_material."model_spec" IS '型号规格';
COMMENT ON COLUMN purchase_material."unit_name" IS '单位';
COMMENT ON COLUMN purchase_material."actual_demand_person" IS '实际需求人';
COMMENT ON COLUMN purchase_material."purchase_responsible" IS '采购负责人';
COMMENT ON COLUMN purchase_material."planned_qty" IS '计划数量';
COMMENT ON COLUMN purchase_material."usage" IS '用途';
COMMENT ON COLUMN purchase_material."subitem_no" IS '子项号';
COMMENT ON COLUMN purchase_material."remark" IS '备注';
COMMENT ON COLUMN purchase_material."stock_material_id" IS '关联二级库物资';
COMMENT ON COLUMN purchase_material."status" IS '计划状态，接口序列化为 正常 / 暂不申购 / 已归档';
COMMENT ON COLUMN purchase_material."created_at" IS '创建时间';
COMMENT ON COLUMN purchase_material."updated_at" IS '更新时间';
COMMENT ON COLUMN purchase_material."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON TABLE stock_balance IS '物资库存余额';
COMMENT ON COLUMN stock_balance."stock_material_id" IS '主键，1:1 关联物资';
COMMENT ON COLUMN stock_balance."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN stock_balance."quantity" IS '当前余额';
COMMENT ON COLUMN stock_balance."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON COLUMN stock_balance."updated_at" IS '更新时间';
COMMENT ON TABLE stock_material_image IS '二级库物资图片关联';
COMMENT ON COLUMN stock_material_image."material_id" IS '主键之一，关联物资';
COMMENT ON COLUMN stock_material_image."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN stock_material_image."file_id" IS '主键之一，关联文件';
COMMENT ON COLUMN stock_material_image."sort_order" IS '展示排序';
COMMENT ON TABLE stock_replenishment_policy IS '补库策略（最低库存阈值）';
COMMENT ON COLUMN stock_replenishment_policy."stock_material_id" IS '主键，1:1 关联物资';
COMMENT ON COLUMN stock_replenishment_policy."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN stock_replenishment_policy."minimum_qty" IS '最低库存阈值，`CHECK (minimum_qty >= 0)`';
COMMENT ON COLUMN stock_replenishment_policy."enabled" IS '是否启用补库策略';
COMMENT ON COLUMN stock_replenishment_policy."created_at" IS '创建时间';
COMMENT ON COLUMN stock_replenishment_policy."updated_at" IS '更新时间';
COMMENT ON COLUMN stock_replenishment_policy."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON TABLE purchase_material_image IS '申购计划图片关联';
COMMENT ON COLUMN purchase_material_image."material_id" IS '主键之一，关联申购计划';
COMMENT ON COLUMN purchase_material_image."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN purchase_material_image."file_id" IS '主键之一，关联文件';
COMMENT ON COLUMN purchase_material_image."sort_order" IS '展示排序';
COMMENT ON TABLE purchase_plan_template IS '周期性申购计划模板';
COMMENT ON COLUMN purchase_plan_template."id" IS '主键';
COMMENT ON COLUMN purchase_plan_template."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN purchase_plan_template."material_code" IS '物资编码；NULL 即未编码';
COMMENT ON COLUMN purchase_plan_template."category" IS '分类';
COMMENT ON COLUMN purchase_plan_template."urgency" IS '紧急程度';
COMMENT ON COLUMN purchase_plan_template."demand_department" IS '需求部门';
COMMENT ON COLUMN purchase_plan_template."name" IS '名称';
COMMENT ON COLUMN purchase_plan_template."model_spec" IS '型号规格';
COMMENT ON COLUMN purchase_plan_template."unit_name" IS '单位';
COMMENT ON COLUMN purchase_plan_template."actual_demand_person" IS '实际需求人';
COMMENT ON COLUMN purchase_plan_template."purchase_responsible" IS '采购负责人';
COMMENT ON COLUMN purchase_plan_template."planned_qty" IS '计划数量';
COMMENT ON COLUMN purchase_plan_template."usage" IS '用途';
COMMENT ON COLUMN purchase_plan_template."subitem_no" IS '子项号';
COMMENT ON COLUMN purchase_plan_template."remark" IS '备注';
COMMENT ON COLUMN purchase_plan_template."stock_material_id" IS '关联二级库物资';
COMMENT ON COLUMN purchase_plan_template."created_at" IS '创建时间';
COMMENT ON COLUMN purchase_plan_template."updated_at" IS '更新时间';
COMMENT ON COLUMN purchase_plan_template."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON TABLE purchase_plan_template_image IS '计划模板图片关联';
COMMENT ON COLUMN purchase_plan_template_image."plan_id" IS '主键之一，关联计划模板';
COMMENT ON COLUMN purchase_plan_template_image."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN purchase_plan_template_image."file_id" IS '主键之一，关联文件';
COMMENT ON COLUMN purchase_plan_template_image."sort_order" IS '展示排序';
COMMENT ON TABLE purchase_request_line IS '申购记录物资行（含计划快照）';
COMMENT ON COLUMN purchase_request_line."id" IS '主键';
COMMENT ON COLUMN purchase_request_line."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN purchase_request_line."purchase_request_id" IS '所属申购记录头';
COMMENT ON COLUMN purchase_request_line."purchase_material_id" IS '来源申购计划（计划删除后置空）';
COMMENT ON COLUMN purchase_request_line."plan_no_snapshot" IS '计划编号快照';
COMMENT ON COLUMN purchase_request_line."plan_date_snapshot" IS '计划日期快照';
COMMENT ON COLUMN purchase_request_line."material_code_snapshot" IS '物资编码快照；NULL 即未编码';
COMMENT ON COLUMN purchase_request_line."category_snapshot" IS '分类快照';
COMMENT ON COLUMN purchase_request_line."demand_department_snapshot" IS '需求部门快照';
COMMENT ON COLUMN purchase_request_line."material_name_snapshot" IS '名称快照';
COMMENT ON COLUMN purchase_request_line."model_spec_snapshot" IS '型号规格快照';
COMMENT ON COLUMN purchase_request_line."unit_name_snapshot" IS '单位快照';
COMMENT ON COLUMN purchase_request_line."actual_demand_person_snapshot" IS '实际需求人快照';
COMMENT ON COLUMN purchase_request_line."purchase_responsible_snapshot" IS '采购负责人快照';
COMMENT ON COLUMN purchase_request_line."plan_remark_snapshot" IS '计划备注快照';
COMMENT ON COLUMN purchase_request_line."stock_material_id_snapshot" IS '关联二级库物资 id 快照（无外键）';
COMMENT ON COLUMN purchase_request_line."purchase_qty" IS '申购数量，`CHECK (purchase_qty > 0)`';
COMMENT ON COLUMN purchase_request_line."status" IS '申购状态文本（普通字符串列，非 ENUM）';
COMMENT ON COLUMN purchase_request_line."usage" IS '用途';
COMMENT ON COLUMN purchase_request_line."usage_hash" IS '`usage` 的 SHA-256 前 32 位，参与唯一键';
COMMENT ON COLUMN purchase_request_line."subitem_no" IS '子项号';
COMMENT ON COLUMN purchase_request_line."trace_no" IS '追溯号';
COMMENT ON COLUMN purchase_request_line."salesperson" IS '业务员';
COMMENT ON COLUMN purchase_request_line."contract_sign_date" IS '合同签订日期（物资级）';
COMMENT ON COLUMN purchase_request_line."unit_price" IS '单价（人民币，物资级；平台同步只补空值，也可人工填写）';
COMMENT ON COLUMN purchase_request_line."created_at" IS '创建时间';
COMMENT ON COLUMN purchase_request_line."updated_at" IS '更新时间';
COMMENT ON COLUMN purchase_request_line."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON TABLE purchase_request_line_image IS '申购记录行图片关联';
COMMENT ON COLUMN purchase_request_line_image."line_id" IS '主键之一，关联申购记录行';
COMMENT ON COLUMN purchase_request_line_image."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN purchase_request_line_image."file_id" IS '主键之一，关联文件';
COMMENT ON COLUMN purchase_request_line_image."sort_order" IS '展示排序';
COMMENT ON TABLE stock_operation_line IS '出入库单据明细行';
COMMENT ON COLUMN stock_operation_line."id" IS '主键';
COMMENT ON COLUMN stock_operation_line."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN stock_operation_line."operation_id" IS '所属单据头';
COMMENT ON COLUMN stock_operation_line."stock_material_id" IS '物资（与 `operation_id` 组合唯一）';
COMMENT ON COLUMN stock_operation_line."quantity" IS '本次数量，`CHECK (quantity > 0)`';
COMMENT ON COLUMN stock_operation_line."remaining_qty" IS '剩余可冲销数量';
COMMENT ON COLUMN stock_operation_line."before_qty" IS '操作前余额';
COMMENT ON COLUMN stock_operation_line."after_qty" IS '操作后余额';
COMMENT ON COLUMN stock_operation_line."material_name_snapshot" IS '名称快照';
COMMENT ON COLUMN stock_operation_line."model_spec_snapshot" IS '型号规格快照';
COMMENT ON COLUMN stock_operation_line."unit_name_snapshot" IS '单位快照';
COMMENT ON COLUMN stock_operation_line."created_at" IS '创建时间';
COMMENT ON COLUMN stock_operation_line."updated_at" IS '更新时间';
COMMENT ON COLUMN stock_operation_line."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON TABLE memo IS '个人备忘录';
COMMENT ON COLUMN memo."id" IS '主键';
COMMENT ON COLUMN memo."title" IS '标题';
COMMENT ON COLUMN memo."content" IS '正文纯文本';
COMMENT ON COLUMN memo."created_by" IS '归属用户（不可为空）';
COMMENT ON COLUMN memo."created_at" IS '创建时间';
COMMENT ON COLUMN memo."updated_at" IS '更新时间';
COMMENT ON COLUMN memo."version" IS '乐观锁版本号（每次更新 +1）';
COMMENT ON TABLE hazard_unit IS '隐患责任单位（单位与责任人一一对应）';
COMMENT ON COLUMN hazard_unit."id" IS '主键';
COMMENT ON COLUMN hazard_unit."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN hazard_unit."name" IS '单位名称（唯一）';
COMMENT ON COLUMN hazard_unit."person" IS '责任人（与单位一一对应，登记隐患时快照到隐患）';
COMMENT ON COLUMN hazard_unit."remark" IS '备注';
COMMENT ON COLUMN hazard_unit."enabled" IS '0=停用（登记下拉不可选）1=启用';
COMMENT ON COLUMN hazard_unit."created_at" IS '创建时间';
COMMENT ON COLUMN hazard_unit."updated_at" IS '更新时间';
COMMENT ON COLUMN hazard_unit."version" IS '乐观锁版本';
COMMENT ON TABLE hazard_type IS '隐患类型（一行一个「大类 + 小类」组合）';
COMMENT ON COLUMN hazard_type."id" IS '主键';
COMMENT ON COLUMN hazard_type."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN hazard_type."major" IS '大类';
COMMENT ON COLUMN hazard_type."minor" IS '小类';
COMMENT ON COLUMN hazard_type."created_at" IS '创建时间';
COMMENT ON COLUMN hazard_type."updated_at" IS '更新时间';
COMMENT ON COLUMN hazard_type."version" IS '乐观锁版本';
COMMENT ON TABLE hazard IS '隐患台账主表（检查信息 + 责任人快照 + 整改状态）';
COMMENT ON COLUMN hazard."id" IS '主键';
COMMENT ON COLUMN hazard."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN hazard."inspection_area" IS '检查区域';
COMMENT ON COLUMN hazard."inspection_date" IS '检查日期';
COMMENT ON COLUMN hazard."inspector" IS '检查人员：网页端登记缺省为「电气自查」，小程序登记缺省为当前小程序用户姓名';
COMMENT ON COLUMN hazard."description" IS '隐患描述';
COMMENT ON COLUMN hazard."suggestion" IS '建议整改方案';
COMMENT ON COLUMN hazard."hazard_unit_id" IS '责任单位';
COMMENT ON COLUMN hazard."person" IS '责任人快照（登记时取自单位，之后单位换人不回写）';
COMMENT ON COLUMN hazard."due_date" IS '要求完成整改时间（缺省 = 检查日期 + 7 天）';
COMMENT ON COLUMN hazard."recheck_person" IS '复查人员（缺省同检查人员）';
COMMENT ON COLUMN hazard."rectify_person" IS '整改员工（可选）';
COMMENT ON COLUMN hazard."status" IS '整改状态：待整改 / 整改受阻 / 已整改';
COMMENT ON COLUMN hazard."hazard_type_id" IS '隐患类型（「大类+小类」组合行）';
COMMENT ON COLUMN hazard."level" IS '隐患等级：一般隐患 / 重大隐患';
COMMENT ON COLUMN hazard."remark" IS '备注';
COMMENT ON COLUMN hazard."client_request_id" IS '小程序登记的幂等键（形如 `mp-<时间戳>-<随机串>`）；网页端登记为空，非空即表示小程序登记';
COMMENT ON COLUMN hazard."created_at" IS '创建时间';
COMMENT ON COLUMN hazard."updated_at" IS '更新时间';
COMMENT ON COLUMN hazard."version" IS '乐观锁版本';
COMMENT ON TABLE hazard_before_image IS '隐患「整改前」图片关联';
COMMENT ON COLUMN hazard_before_image."hazard_id" IS '隐患（与 `file_id` 组合主键）';
COMMENT ON COLUMN hazard_before_image."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN hazard_before_image."file_id" IS '图片对象';
COMMENT ON COLUMN hazard_before_image."sort_order" IS '展示顺序（按上传顺序）';
COMMENT ON TABLE hazard_after_image IS '隐患「整改后」图片关联';
COMMENT ON COLUMN hazard_after_image."hazard_id" IS '隐患（与 `file_id` 组合主键）';
COMMENT ON COLUMN hazard_after_image."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN hazard_after_image."file_id" IS '图片对象';
COMMENT ON COLUMN hazard_after_image."sort_order" IS '展示顺序';
COMMENT ON TABLE ledger_tag IS '台账标签节点（自引用邻接表，至多 3 层）';
COMMENT ON COLUMN ledger_tag."id" IS '主键';
COMMENT ON COLUMN ledger_tag."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN ledger_tag."parent_id" IS '上级标签；NULL 表示根节点（该节点层级 1，全树至多 3 层）';
COMMENT ON COLUMN ledger_tag."name" IS '标签名称（同一层级下唯一，由服务端校验）';
COMMENT ON COLUMN ledger_tag."remark" IS '备注（节点悬停浮层展示）';
COMMENT ON COLUMN ledger_tag."created_at" IS '创建时间';
COMMENT ON COLUMN ledger_tag."updated_at" IS '更新时间';
COMMENT ON COLUMN ledger_tag."version" IS '乐观锁版本';
COMMENT ON TABLE ledger_tag_image IS '台账标签图片关联';
COMMENT ON COLUMN ledger_tag_image."tag_id" IS '标签（与 `file_id` 组合主键）';
COMMENT ON COLUMN ledger_tag_image."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN ledger_tag_image."file_id" IS '图片对象';
COMMENT ON COLUMN ledger_tag_image."sort_order" IS '展示顺序（按上传顺序，每个标签最多 9 张）';
COMMENT ON TABLE ledger IS '台账记录（名称 / 型号 / 子项号 / 数量 / 单位 / 用途 / 备注 / 标签）';
COMMENT ON COLUMN ledger."id" IS '主键';
COMMENT ON COLUMN ledger."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN ledger."name" IS '名称';
COMMENT ON COLUMN ledger."model_spec" IS '型号';
COMMENT ON COLUMN ledger."subitem_no" IS '子项号（技改项目下的子项编号，可留空；PATCH 传空串即清空）';
COMMENT ON COLUMN ledger."quantity" IS '数量（整数件数，按台 / 套 / 件统计）';
COMMENT ON COLUMN ledger."unit_name" IS '单位；列表与数量合并展示（如「12 台」），因此必填';
COMMENT ON COLUMN ledger."usage" IS '用途';
COMMENT ON COLUMN ledger."remark" IS '备注';
COMMENT ON COLUMN ledger."tag_ids" IS '标签 id，英文逗号分隔（如 `''3,12,15''`），空串 = 未挂标签；写入时由服务端校验 id 存在并去重、升序规范化，单条记录最多 20 个标签';
COMMENT ON COLUMN ledger."created_at" IS '创建时间';
COMMENT ON COLUMN ledger."updated_at" IS '更新时间';
COMMENT ON COLUMN ledger."version" IS '乐观锁版本';
COMMENT ON TABLE ledger_image IS '台账记录图片关联';
COMMENT ON COLUMN ledger_image."ledger_id" IS '台账记录（与 `file_id` 组合主键）';
COMMENT ON COLUMN ledger_image."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN ledger_image."file_id" IS '图片对象';
COMMENT ON COLUMN ledger_image."sort_order" IS '展示顺序（按上传顺序，每条记录最多 9 张）';
COMMENT ON TABLE work_task IS '工作任务（活）：名称 / 状态 / 计划起止 / 工作内容 / 备注';
COMMENT ON COLUMN work_task."id" IS '主键';
COMMENT ON COLUMN work_task."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN work_task."name" IS '任务名称（同一项目内唯一，重名由服务端返回 409 `DUPLICATE_WORK_TASK`）';
COMMENT ON COLUMN work_task."description" IS '工作内容（PATCH 传空串即清空）';
COMMENT ON COLUMN work_task."status" IS '任务状态（接口按中文取值「未开始 / 进行中 / 已完成 / 已暂停」输出，人工维护、不做流转校验）';
COMMENT ON COLUMN work_task."plan_start_date" IS '计划开始日期';
COMMENT ON COLUMN work_task."plan_end_date" IS '计划结束日期';
COMMENT ON COLUMN work_task."remark" IS '备注（备件、工作票、停机窗口等）';
COMMENT ON COLUMN work_task."created_at" IS '创建时间';
COMMENT ON COLUMN work_task."updated_at" IS '更新时间';
COMMENT ON COLUMN work_task."version" IS '乐观锁版本';
COMMENT ON TABLE work_task_image IS '任务图片关联';
COMMENT ON COLUMN work_task_image."task_id" IS '任务（与 `file_id` 组合主键）';
COMMENT ON COLUMN work_task_image."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN work_task_image."file_id" IS '图片对象';
COMMENT ON COLUMN work_task_image."sort_order" IS '展示顺序（按上传顺序，每个任务最多 9 张）';
COMMENT ON TABLE work_record IS '工作记录：任务 + 起止（上午 / 下午）+ 参与人员 + 备注';
COMMENT ON COLUMN work_record."id" IS '主键';
COMMENT ON COLUMN work_record."project_id" IS '所属项目（业务数据按项目隔离）';
COMMENT ON COLUMN work_record."task_id" IS '所属任务（外键 RESTRICT：删任务前必须先删记录）';
COMMENT ON COLUMN work_record."start_date" IS '工作记录开始日期';
COMMENT ON COLUMN work_record."start_half" IS '开始半日（AM / PM）';
COMMENT ON COLUMN work_record."end_date" IS '工作记录结束日期';
COMMENT ON COLUMN work_record."end_half" IS '结束半日（AM / PM）';
COMMENT ON COLUMN work_record."participants" IS '参与人员姓名，以「、」连接（最多 20 人 × 24 字含分隔符 = 500 字符）；写入时服务端按顿号 / 逗号 / 分号 / 空格等分隔符拆分、去空、去重保序后规范化落库，读接口还原成姓名列表';
COMMENT ON COLUMN work_record."remark" IS '这一步的具体内容、交接说明等';
COMMENT ON COLUMN work_record."created_at" IS '创建时间';
COMMENT ON COLUMN work_record."updated_at" IS '更新时间';
COMMENT ON COLUMN work_record."version" IS '乐观锁版本';
