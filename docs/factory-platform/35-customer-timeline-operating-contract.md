# 客户行为时间线运营契约

## 1. 经营目的与客户买点

客户行为时间线把内容触点、询盘推进、报价、订单和服务五类真实业务事件按发生时间串联。营销、销售与服务看到的是同一条可追溯旅程，而不是人工拼接的备注。客户购买的不是活动列表，而是一套“来源权威、修订固定、异人核验、节点可标记、版本不可变、下游有回执”的客户经营基础设施。

## 2. 权威来源与共享契约

- `marketing-touchpoint`：有同意引用和证据指纹的内容或网站触点。
- `inquiry-flow`：收入黄金流中的询盘阶段与关联编号。
- `cpq-quote`：未脱离业务系统权威边界的 CPQ 报价。
- `fulfillment-order`：OMS 订单与固定报价引用。
- `service-ticket`：通过装机资产反查账户的服务工单。

```text
source_records_copied = false
source_revision_pinned = true
source_fingerprint_pinned = true
raw_tracking_identifier_stored = false
event_self_verification = false
incomplete_timeline_publishable = false
timeline_author_self_publish = false
published_versions_mutable = false
consumer_system_mutated = false
acknowledgement_required = true
```

## 3. 状态机与职责分离

- 时间线：`draft → published`
- 事件：`pending → verified`
- 版本：创建即为不可变 `published`
- 交付：`pending → acknowledged`

事件创建者不能自行核验，时间线作者不能自行发布，发布者不能自行确认下游回执。任一来源编号、账户、修订、状态、快照或指纹漂移，事件核验和时间线发布必须阻断。五类来源任一缺失或未核验均不得发布。

## 4. 权限、租户与审计

- `factory.portrait.timeline.manage`
- `factory.portrait.timeline.event.verify`
- `factory.portrait.timeline.checkpoint.manage`
- `factory.portrait.timeline.publish`
- `factory.portrait.timeline.handoff.acknowledge`

六张时间线表均携带 `project_id`、`agent_path`、`tenant_id`、`client_id`、`plan_id`。写操作通过项目权限检查，并记录 `factory.timeline.*` 平台审计；跨项目查询必须为空。

## 5. 运营指标与验收

- 已核验事件数和五类来源覆盖率
- 高意向事件数
- 关键旅程节点数
- 已发布不可变版本数
- CRM、CDP、销售、服务四类下游回执率

完成条件：五类来源覆盖 100%，全部事件异人核验；发生时间排序稳定；关键节点引用已核验事件；版本哈希可重算；四类下游全部回执；上游触点、询盘、报价、订单、资产和服务工单未被复制或修改；不保存原始跟踪标识；证据、审计与权限齐全。

## 6. 迁移与回滚

迁移为 `5f9b2d7e4a16`，上游为 `4e8a1c6d3f05`。回滚前导出版本哈希、事件来源指针、关键节点和下游回执。回滚只删除时间线投影、版本、交付、证据和新增权限，绝不删除或修改触点、询盘、报价、订单、资产、服务工单及下游 CRM/CDP 记录。

## 7. 开发与验收顺序

1. Alembic 升级、回滚、再升级。
2. 专属测试覆盖职责分离、五类完整性、来源漂移与租户隔离。
3. 全量工厂测试、布局和租户上下文。
4. TypeScript、蓝图契约、15 道开发门禁和生产构建。
5. 三类身份执行真实 API 事件链、关键节点和四类回执。
6. 数据库复核来源未改、无原始跟踪标识、版本哈希、证据、审计和权限。
7. 真实页面核对指标、导航、面包屑和横向溢出。
