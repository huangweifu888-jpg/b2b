# 03.营搜｜技术SEO运营契约

`trust.technical-seo` 的可运营闭环是：`站点与证据引用 → 不可变健康快照 → 异人核验 → 有回退的修复交接 → 异人批准 → 站点负责方回执`。每条记录都绑定 `agent_path`、`tenant_id`、`client_id`、`plan_id` 和 `project_id`，跨项目读取或交接一律拒绝。

## 事实源与边界

- 审计只引用获授权的站点、抓取和性能证据；不保存搜索平台登录凭据、Cookie、令牌、客户邮箱或手机号。
- 本应用不自动改写网站页面、robots、sitemap、服务器规则或搜索平台设置；它交付可审计、可回退的修复包，由站点负责方在其权威系统执行并回执。
- 站点健康改善不能承诺收录、流量或排名。发布契约明确 `public_site_mutated_directly=false`、`search_console_credential_stored=false`、`search_ranking_guaranteed=false`。

## 对象、事件与职责分离

迁移 `7c5e2f9a1d84` 建立审计、快照、修复交接和证据四张租户表，并冻结对象 `technical-seo-evidence-snapshot` 与事件 `technical-seo-remediation-released`。权限为：

- `factory.trust.technical-seo.audit.manage`
- `factory.trust.technical-seo.snapshot.verify`
- `factory.trust.technical-seo.release.approve`
- `factory.trust.technical-seo.handoff.acknowledge`

快照采集人不得自行核验；交接准备人不得自行批准；批准人不得登记消费者回执。每一步写入项目审计和本应用证据记录。回滚只删除本应用的治理投影、权限和冻结契约，不删除客户网站、爬虫来源、站点负责方的修复记录或搜索平台配置。

## 三端可视化共享契约

总部定义审计范围、证据门禁和版本；代理源端可在获授权项目中组织修复包；客户源端/站点负责方通过共享页面在明确范围内确认接收。`/seo?tab=audit` 保留既有分析工具，并新增受控治理面板；面板使用统一项目编号、实时状态、六步操作和窄屏可换行布局，不复制或替换既有 SEO 数据展示。

## 验收

后端单元验收：`backend/tests/test_factory_technical_seo.py`。

三身份 API 验收：`tools/run_technical_seo_api_acceptance.ps1`。必须获得 `release_available=true`、`availability=available`，并验证三项边界字段均为 `false` 和消费者回执要求为 `true`。真实页面验收需验证 `/seo?tab=audit` 的 `data-technical-seo-mode="live"`、完整六步操作、治理记录及无横向溢出后，方可将蓝图状态升格为 `available`。

2026-08-06：迁移 `7c5e2f9a1d84` 已完成隔离数据库的升级、回滚和再升级演练，并已迁移到本地开发库。总部、代理、客户三身份 API 获取 `available` 的修复交接回执，同时证明 `public_site_mutated_directly=false`、`search_console_credential_stored=false`、`search_ranking_guaranteed=false`。`/seo?tab=audit` 的共享客户源页面得到 `live`、三条治理记录、六个生命周期动作且无横向溢出；因此 `trust.technical-seo` 已提升为 `available`。
