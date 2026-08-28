# 03.营搜｜排名与搜索份额运营契约

`trust.search-share` 的唯一事实源是受控的搜索表现数据集：`数据来源与观察窗口 → 不可变表现快照 → 异人质量核验 → 受限分析交接 → 异人批准 → 消费者回执`。每条记录必须绑定 `agent_path`、`tenant_id`、`client_id`、`plan_id` 与 `project_id`。

## 三端职责与边界

总部登记数据源、国家市场、搜索引擎与观察窗口；代理独立核验数据完整性与方法；客户市场或经营端确认接收趋势分析。系统只能呈现来源、时间范围、排名/份额观察和不确定性，不得承诺排名、把相关性写成单一动作归因，或自动投放、改站、修改内容。

## 计划中的交付链

后续实现会保存原始来源引用和哈希、关键词/竞争对象范围、地域与设备口径、表现快照、质量检查、分析交接、批准与回执。回滚仅删除本应用治理投影与权限，不删除来源数据、客户站点、广告账户或下游工作。

## 升格门槛

`a4e7b2c9d106` 的迁移固定对象契约 `search-share-performance-snapshot` 与事件契约 `search-share-analysis-released`，并为总部、代理、客户三端写入数据管理、异人核验、批准和回执权限。回滚仅撤销本应用治理记录、权限和契约，绝不删除搜索来源、客户站点、广告账户或下游工作。

**Search share boundaries:** the service reports observations, trend and correlation only. It makes no ranking guarantee, never attributes change to a single action, and never automatically changes a site, content, campaign or advertisement.

当前实现已具备数据模型、租户权限、审计 API、对象事件契约、迁移回滚、自动化测试、三端 API 与 `/seo?tab=ranking` 的真实治理页面。只有三身份实测、迁移演练、生产构建与 H 版本证据完整通过后，才能从 `pilot` 提升为 `available`。
