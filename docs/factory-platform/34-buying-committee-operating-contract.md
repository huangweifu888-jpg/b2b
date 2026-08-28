# 采购画像与决策委员会运营契约

## 1. 经营目的与客户买点

采购画像把已经发生的 CPQ 商机、ICP 采购角色与得到明确授权的联系人，组织成一张可核验的多线程决策网络。销售不再只依赖单一联系人，而是能看到经济决策者、技术决策者、推动者以及他们之间的审批和影响关系。客户购买的不是一张静态通讯录，而是一套“商机真实、角色完整、联系人合规、关系有证据、版本可追溯、交接有回执”的复杂销售基础设施。

## 2. 权威来源与共享契约

- 商机只引用未作废的 CPQ 报价，并固定编号、修订、状态和事实指纹。
- 采购角色只引用已启用 ICP 的当前不可变版本，并固定每个角色的定义指纹。
- 成员只引用有效同意下已核验的联系人、邮箱或电话信号；只保存不可逆哈希与脱敏提示。
- 影响路径必须连接两个已核验成员，携带业务证据，并由创建者之外的人员核验。

```text
source_records_copied = false
consented_contacts_only = true
opportunity_revision_pinned = true
icp_role_definition_pinned = true
member_self_verification = false
influence_self_verification = false
incomplete_committee_publishable = false
committee_author_self_publish = false
published_versions_mutable = false
consumer_system_mutated = false
acknowledgement_required = true
```

## 3. 状态机与职责分离

- 委员会：`draft → published`
- 委员：`pending → verified`
- 影响路径：`pending → verified`
- 版本：创建即为不可变 `published`
- 交付：`pending → acknowledged`

成员创建者不能自行核验，路径创建者不能自行核验，委员会作者不能自行发布，发布者不能自行确认下游回执。任一 CPQ 修订、ICP 定义、采购角色、同意状态或联系人指纹漂移，后续核验和发布都必须阻断。

## 4. 权限、租户与审计

- `factory.portrait.buying.committee.manage`
- `factory.portrait.buying.member.verify`
- `factory.portrait.buying.influence.manage`
- `factory.portrait.buying.influence.verify`
- `factory.portrait.buying.publish`
- `factory.portrait.buying.handoff.acknowledge`

六张业务表均携带 `project_id`、`agent_path`、`tenant_id`、`client_id`、`plan_id`。路由层对每次写操作执行项目权限校验，并记录 `factory.buying.*` 平台审计；跨项目查询必须为空。

## 5. 运营指标与验收

- 已核验成员数与 ICP 必需角色覆盖率
- 同时覆盖三个及以上角色的多线程商机数
- 已核验影响路径数与全成员连通性
- 已发布不可变版本数
- CRM、销售、营销、服务四类下游回执率

完成条件：三类 ICP 角色 100% 覆盖且成员全部异人核验；至少两条影响路径连接全部成员并全部异人核验；版本哈希可重算；四类下游全部回执；上游 CPQ、ICP、角色、同意及身份信号未被复制或修改；原始联系人标识未落库；业务证据、平台审计和权限齐全。

## 6. 迁移与回滚

迁移为 `4e8a1c6d3f05`，上游为 `3d7f0b5c2e94`。回滚前导出委员会版本哈希、商机与角色指针、联系人哈希、影响路径证据和下游回执。回滚只删除采购画像投影、版本、交付、证据与新增权限，绝不删除或修改 CPQ、ICP、身份同意、身份信号以及下游 CRM/销售/营销/服务记录。

## 7. 开发与验收顺序

1. Alembic 升级、回滚、再升级。
2. 专属测试覆盖职责分离、不完整发布阻断、来源漂移和租户隔离。
3. 全量工厂测试、布局与租户上下文测试。
4. TypeScript、蓝图契约、15 道开发门禁与生产构建。
5. 总部、代理、客户三类身份执行真实 API 多线程委员会与四类回执。
6. 数据库复核来源未改、无原始标识、版本哈希、证据、审计与权限。
7. 真实页面核对指标、导航、面包屑与横向溢出。
