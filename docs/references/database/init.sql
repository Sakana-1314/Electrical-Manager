-- 电气车间备件管理系统 PostgreSQL 16+ 初始化脚本
-- 使用方式：先在 PostgreSQL 中创建空数据库，再连接该数据库执行本文件。
-- 本脚本不创建数据库或数据库账号，也不会由业务容器自动执行。
-- 可重复执行：类型 / 表 / 索引均按「已存在则跳过」处理，种子数据按唯一键更新或跳过。

-- 枚举类型：库内保存枚举「名」（如 PENDING），接口按枚举「值」输出中文字段见各表注释。
DO $$
BEGIN
  CREATE TYPE role AS ENUM ('SUPER_ADMIN', 'WAREHOUSE_ADMIN', 'PURCHASE_ADMIN', 'HAZARD_ADMIN', 'READ_ONLY', 'LEDGER_ADMIN', 'WORK_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

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

CREATE TABLE IF NOT EXISTS "user" (
  id BIGSERIAL NOT NULL,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  api_token_hash VARCHAR(64) NOT NULL,
  api_token_enc VARCHAR(512) NOT NULL DEFAULT '',
  display_name VARCHAR(128) NOT NULL,
  role role NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_user PRIMARY KEY (id),
  CONSTRAINT uq_user_username UNIQUE (username),
  CONSTRAINT uq_user_api_token_hash UNIQUE (api_token_hash)
);

CREATE TABLE IF NOT EXISTS mini_program_user (
  id BIGSERIAL NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  department_name VARCHAR(128) NOT NULL DEFAULT '华星检修维护部电气车间',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMP WITHOUT TIME ZONE NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_mini_program_user PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS mini_program_identity (
  id BIGSERIAL NOT NULL,
  mini_program_user_id BIGINT NOT NULL,
  app_id VARCHAR(64) NOT NULL,
  wechat_openid VARCHAR(128) NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_mini_program_identity PRIMARY KEY (id),
  CONSTRAINT uq_mini_program_identity_app_id UNIQUE (app_id, wechat_openid),
  CONSTRAINT uq_mini_program_identity_mini_program_user_id UNIQUE (mini_program_user_id, app_id),
  CONSTRAINT fk_mini_program_identity_mini_program_user_id_mini_program_user
    FOREIGN KEY (mini_program_user_id) REFERENCES mini_program_user (id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS webhook_channel (
  id BIGSERIAL NOT NULL,
  platform webhookplatform NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_url_encrypted VARCHAR(2000) NOT NULL DEFAULT '',
  secret_encrypted VARCHAR(2000) NOT NULL DEFAULT '',
  subscribed_events JSON NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_webhook_channel PRIMARY KEY (id),
  CONSTRAINT uq_webhook_channel_platform UNIQUE (platform)
);

CREATE TABLE IF NOT EXISTS webhook_delivery (
  id BIGSERIAL NOT NULL,
  event_id VARCHAR(36) NOT NULL,
  event_type webhookeventtype NOT NULL,
  channel_id BIGINT NOT NULL,
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
  CONSTRAINT uq_webhook_delivery_event_id UNIQUE (event_id, channel_id),
  CONSTRAINT fk_webhook_delivery_channel_id_webhook_channel
    FOREIGN KEY (channel_id) REFERENCES webhook_channel (id)
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
    FOREIGN KEY (created_by) REFERENCES "user" (id),
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
    FOREIGN KEY (created_by) REFERENCES "user" (id),
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
    FOREIGN KEY (created_by) REFERENCES "user" (id),
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
    FOREIGN KEY (created_by) REFERENCES "user" (id) ON DELETE CASCADE
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

-- 首次登录账号，默认密码均为 123456。重复导入不会重置已有账号密码。
-- API 令牌用 gen_random_uuid() 生成（32 位十六进制 + 连字符），只保存 SHA-256 哈希。
INSERT INTO "user" (username, password_hash, api_token_hash, display_name, role, enabled)
VALUES
  ('admin', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '系统管理员', 'SUPER_ADMIN', TRUE),
  ('warehouse', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '仓库管理员', 'WAREHOUSE_ADMIN', TRUE),
  ('purchase', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '申购管理员', 'PURCHASE_ADMIN', TRUE),
  ('hazard', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '隐患管理员', 'HAZARD_ADMIN', TRUE),
  ('ledger', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '台账管理员', 'LEDGER_ADMIN', TRUE),
  ('work', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '工作管理员', 'WORK_ADMIN', TRUE),
  ('readonly', '$argon2id$v=19$m=65536,t=3,p=4$VNlqfY9XSeszkV1Ry0SIiQ$/ll+8yljB5zZ/oCnO9cj+dzh4p05nebxSdxy1icYrKg', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), '只读用户', 'READ_ONLY', TRUE)
ON CONFLICT (username) DO UPDATE
SET display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    enabled = EXCLUDED.enabled;
