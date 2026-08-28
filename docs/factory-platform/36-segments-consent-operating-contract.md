# 标签分群与同意中心运营契约

## 1. 经营目的与客户买点

标签分群与同意中心把“客户是谁、是否同意、何时表现出意向、可以在哪个渠道触达”合并为一条可审计的经营链。客户购买的不是一套任意打标签的工具，而是一套以有效同意、已核验身份、不可变客户时间线和确定性规则为基础的安全增长基础设施。它让市场、销售、广告与服务使用同一个已授权客群，并在撤回同意后立即停止纳入。

## 2. 权威来源与共享边界

- 身份合并中心提供已核验的联系人哈希及当前有效同意，不保存原始邮箱、电话或设备标识。
- 客户行为时间线提供已发布版本、五类来源覆盖和高意向事件数。
- 分群规则只使用显式阈值、来源类型和同意目的，AI 不得自主决定入群。
- CRM、营销、广告和服务只接收不可变版本哈希并显式回执，不反向改写来源系统。

```text
source_records_copied = false
raw_identifier_stored = false
active_consent_required = true
consent_revocation_excludes_membership = true
timeline_version_pinned = true
rule_definition_pinned = true
ai_autonomous_segmentation = false
membership_self_verification = false
segment_author_self_publish = false
published_versions_mutable = false
consumer_system_mutated = false
acknowledgement_required = true
```

## 3. 状态机与职责分离

- 分群：`draft → published`
- 规则：`draft → approved`
- 成员：`pending → verified`
- 激活：`pending → acknowledged`

规则作者不得自批规则，成员评估人不得自验成员，分群作者不得自行发布，发布人不得自行确认下游回执。成员核验和发布前都必须重新读取有效同意、身份信号、规则哈希和时间线版本；任何撤回、过期或指纹漂移都会阻断操作。

## 4. 权限、租户与审计

- `factory.portrait.segment.manage`
- `factory.portrait.segment.rule.approve`
- `factory.portrait.segment.membership.evaluate`
- `factory.portrait.segment.membership.verify`
- `factory.portrait.segment.publish`
- `factory.portrait.segment.activation.acknowledge`

六张业务表均携带 `project_id`、`agent_path`、`tenant_id`、`client_id`、`plan_id`。所有写操作经过项目权限检查并记录 `factory.segment.*` 平台审计；跨项目读取必须为空。

## 5. 运营指标与验收

- 已发布有效分群数
- 已核验成员数和同意资格率
- 高意向成员数
- 不可变分群版本数
- CRM、营销、广告、服务四渠道回执率

完成条件：规则与成员均由异人审核；每个成员具备有效同意、已核验身份和不可变时间线版本；规则、时间线及同意指纹均可重算；发布版本哈希可重算；四类渠道全部回执；撤回同意立即排除后续核验和发布；不保存原始标识，不复制或修改上游记录，不改写下游系统；证据、审计和权限齐全。

## 6. 迁移与回滚

迁移为 `6a0c3e8f5b27`，上游为 `5f9b2d7e4a16`。回滚前导出分群定义、规则哈希、成员资格、版本清单和渠道回执。回滚只删除分群投影、版本、激活、证据和新增权限，绝不删除或修改身份同意、身份信号、客户时间线或下游系统记录。

## 7. 开发与验收顺序

1. Alembic 升级、回滚、再升级。
2. 专属测试覆盖职责分离、规则失败、同意撤回、来源漂移和租户隔离。
3. 全量工厂测试、布局和租户上下文检查。
4. TypeScript、蓝图契约、15 道开发门禁和生产构建。
5. 三类身份执行真实 API 分群、规则、成员、发布和四渠道回执。
6. 数据库复核上游未改、无原始标识、哈希、证据、审计和权限。
7. 真实页面核对指标、导航、面包屑和横向溢出。
