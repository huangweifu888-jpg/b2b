# 02.布场｜企业资料中心运营契约

## 商业闭环

`资料主档 -> 当前编辑内容固化 -> 独立核验 -> 受控交接 -> 独立批准 -> 下游回执`。

企业资料是统一展示层，不取代 ERP、HR、法务、质量或 CRM 中的事实源。每条记录都绑定 `agent_path`、`tenant_id`、`client_id`、`plan_id` 和 `project_id`，项目之间不可互读。

## 编辑器与发布边界

`/company-info?tab=profile` 保留原有资料编辑器和客户本地草稿；新增“企业资料受控发布”面板仅将用户显式选择的当前内容固化为不可篡改版本。它不会自动覆盖草稿、写回源系统、发布客户网站，也不保存密码、令牌、密钥或凭据。

敏感键（`password`、`secret`、`token`、`private_key`、`api_key`、`credential`）会被接口拒绝。作者不得核验自己的版本；交接准备者不得批准；批准者不得登记自己的消费者回执。

## 可运营证据门槛

在蓝图仍为 `pilot` 时，必须补齐受控模型、项目权限与审计、冻结 `company-profile-version` 对象契约、冻结 `company-profile-released` 事件契约、真实页面/API、迁移回滚、自动化测试、生产构建和实际页面验收。只有这全部通过，才可将 `content.company` 升格为 `available`。

三身份真实接口验收命令为 `tools/run_company_profile_api_acceptance.ps1`：总部建立主档和版本、代理独立核验/批准、客户侧登记下游回执。回滚只删除本应用治理投影、权限及契约，绝不删除原编辑草稿、企业源资料或任何客户网站内容。

2026-08-06：迁移 `1c6f4a9b3c16` 已完成升级、回滚及再次升级演练；三身份接口得到 `available` 发布和消费者回执；`/company-info?tab=profile` 的共享客户源页面得到 live 状态、四条治理记录、六个生命周期动作且无横向溢出。因此 `content.company` 已明确提升为 `available`。
