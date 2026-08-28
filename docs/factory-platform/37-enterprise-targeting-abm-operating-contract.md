# 企业定向与 ABM 运营契约

## 1. 经营目的与客户买点

企业定向把“重点企业名单”升级为可解释、可复核、可协同的增长计划：只有同时进入有效同意分群并拥有已发布采购委员会的企业才能成为目标账户；每个真实采购角色都必须有明确负责人、触达渠道、行动意图和成功信号。客户购买的不是黑箱名单或自动群发，而是市场、广告和销售围绕同一企业、同一采购角色、同一证据版本协同成交的基础设施。

## 2. 权威来源与共享边界

- 标签分群与同意中心提供已发布人群版本、有效同意成员哈希及触达用途。
- 采购画像提供已发布采购委员会、真实商机、ICP 角色和已核验联系人哈希。
- 企业定向只保存来源编号、版本、哈希、角色计划和业务回执，不复制原始联系人标识。
- CRM、营销、广告和销售仅接收不可变 ABM 计划哈希并显式回执，不反向改写来源系统。

```text
source_records_copied = false
audience_version_pinned = true
buying_committee_version_pinned = true
active_consent_revalidated = true
complete_role_coverage_required = true
target_account_self_verification = false
role_play_self_approval = false
ai_autonomous_targeting = false
program_author_self_publish = false
published_versions_mutable = false
consumer_system_mutated = false
acknowledgement_required = true
```

## 3. 状态机与职责分离

- 企业定向计划：`draft → published`
- 目标企业：`pending → verified`
- 角色剧本：`draft → approved`
- 系统激活：`pending → acknowledged`

目标企业创建人不得自行核验，角色剧本作者不得自行批准，计划作者不得自行发布，发布人不得自行确认系统回执。核验、批准和发布都会重新校验有效同意、分群版本、采购委员会版本、商机、ICP 角色及联系人哈希；撤回同意或任一来源漂移都会阻断流程。

## 4. 权限、租户与审计

- `factory.lead.abm.manage`
- `factory.lead.abm.target.verify`
- `factory.lead.abm.play.approve`
- `factory.lead.abm.publish`
- `factory.lead.abm.activation.acknowledge`

六张 ABM 表均携带 `project_id`、`agent_path`、`tenant_id`、`client_id`、`plan_id`。写操作经过项目权限检查并记录 `factory.abm.*` 平台审计；跨项目读取必须为空。

## 5. 运营指标与验收

- 已发布 ABM 计划数
- 已核验目标企业数
- 采购角色覆盖率与已批准角色剧本数
- 不可变计划版本数
- CRM、营销、广告、销售四系统回执率

完成条件：目标企业来自有效同意分群且采购委员会联系人全部被同意成员覆盖；企业和剧本均异人审核；每个采购角色恰好一个已批准剧本；角色覆盖率 100%；来源、剧本和版本哈希可重算；四系统全部回执；不保存原始标识、不复制或修改上游记录、不改写下游系统；证据、审计和权限齐全。

## 6. 迁移与回滚

迁移为 `7b1d4f9a6c38`，上游为 `6a0c3e8f5b27`。回滚前导出目标企业来源指纹、角色剧本定义、版本清单和系统回执。回滚只删除 ABM 计划、目标投影、剧本、版本、激活、证据和新增权限，绝不删除或修改同意分群、身份记录、采购委员会、ICP、CPQ 或下游系统。

## 7. 开发与验收顺序

1. Alembic 升级、回滚、再升级。
2. 专属测试覆盖职责分离、完整角色、同意撤回、来源漂移和租户隔离。
3. 全量工厂测试、布局和租户上下文检查。
4. TypeScript、蓝图契约、15 道开发门禁和生产构建。
5. 三类身份执行真实 API 企业、角色剧本、发布和四系统回执。
6. 数据库复核上游未改、无原始标识、哈希、证据、审计和权限。
7. 真实页面核对指标、导航、面包屑和横向溢出。
