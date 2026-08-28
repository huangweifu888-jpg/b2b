# B2B企业关系图谱运营契约

## 1. 经营目的与客户买点

企业关系图谱把法务主体、黄金账户、已同意联系人、CPQ商机和履约订单连接为一张可审计的B2B关系网。销售可识别集团、分支、经销商、联系人与商机；服务可沿账户找到订单和交付；管理者可看到关系覆盖深度。客户购买的不是一张人工绘制的关系图，而是一条“来源固定、语义受控、异人核验、版本可追溯、下游有回执”的客户经营基础设施。

## 2. 权威来源与关系边界

- `legal-party`：只接受已批准的法务主体，作为企业节点。
- `golden-profile`：只接受哈希有效的已发布黄金档案，作为账户节点。
- `identity-signal`：只接受有效同意下的已核验联系人/邮箱/电话哈希，作为联系人节点；不保存原始标识。
- `cpq-quote`：接受未作废的报价/商机，作为机会节点。
- `fulfillment-order`：接受未作废的OMS订单，作为履约节点。
- `has-opportunity`、`contact-at`、`fulfills`、`identity-of` 必须满足账户引用一致；`fulfills` 还必须固定原始报价ID。
- `parent-of`、`branch-of`、`distributor-of` 必须是企业对企业关系，并携带外部登记或合作证据引用。

共享契约：

```text
source_records_copied = false
source_revision_pinned = true
source_fingerprint_pinned = true
node_self_verification = false
edge_self_verification = false
unverified_relation_publishable = false
graph_author_self_publish = false
published_versions_mutable = false
consumer_system_mutated = false
acknowledgement_required = true
```

## 3. 状态机与职责分离

- 关系图：`draft → published`
- 节点：`pending → verified`
- 关系：`pending → verified`
- 版本：创建即为不可变 `published`
- 交付：`pending → acknowledged`

节点创建者不能自核验，关系创建者不能自核验，图谱作者不能自发布，发布人不能自确认下游回执。来源修订、状态、快照或指纹变化时，关系创建、核验和发布全部阻断。

## 4. 权限与审计

- `factory.portrait.account.graph.manage`
- `factory.portrait.account.node.verify`
- `factory.portrait.account.relation.manage`
- `factory.portrait.account.relation.verify`
- `factory.portrait.account.publish`
- `factory.portrait.account.handoff.acknowledge`

六张领域表均携带 `project_id`、`agent_path`、`tenant_id`、`client_id`、`plan_id`；所有写操作在路由层执行项目权限检查并记录 `factory.account.*` 审计。

## 5. 运营指标与验收

- 已核验节点数与五类权威来源覆盖率
- 已核验关系数与关系验证率
- 每账户企业、联系人、商机和订单覆盖深度
- 已发布不可变版本数
- CRM、CDP、销售、服务四类下游回执率

完成条件：五类来源覆盖100%；主体→商机、账户→联系人、商机→订单三条真实关系全部异人核验；版本哈希可重算；所有下游确认；上游主记录未复制、未修改；跨项目查询为空；业务证据和平台审计齐全。

## 6. 迁移与回滚

迁移：`3d7f0b5c2e94`，上游：`2c6e9a4b1d83`。

回滚前导出图谱版本哈希、节点来源指针、关系证据和下游回执。回滚只删除关系图投影、关系、版本、交付、证据和新增权限，绝不删除或修改法务主体、黄金档案、身份信号、CPQ报价、履约订单或下游CRM/CDP记录。

## 7. 开发与验收顺序

1. Alembic升级、回滚、再升级。
2. 专属测试覆盖职责分离、语义错配、来源漂移和租户隔离。
3. 全量工厂测试、布局与租户上下文。
4. TypeScript、蓝图契约、15道开发门禁与生产构建。
5. 三类身份执行真实API关系链和四类下游回执。
6. 数据库复核来源未改、关系哈希、证据、审计与权限。
7. 真实页面核对指标、导航、面包屑和横向溢出。
