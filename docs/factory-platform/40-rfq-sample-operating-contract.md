# RFQ 与样品管理运营契约

## 1. 客户买点

RFQ 与样品管理把“客户询盘—技术澄清—打样审批—寄样—客户反馈—销售确认”变成一条可追溯闭环。工厂不再依赖聊天记录和表格猜测最新版需求，也不会在样品成本、交期和转单意向上形成无人负责的口头承诺。每一次审批都有责任人、版本和证据，适合国内与海外 B2B 复杂产品销售。

## 2. 权威来源与业务边界

- 只接收进入 `inquiry-created` 或更后阶段的收入黄金流，并固定来源修订号、阶段、产品、企业引用哈希和完整快照指纹。
- 每次需求审核、样品审批、发运、反馈和回执前重新校验来源；询盘阶段或修订漂移立即阻断。
- RFQ 不复制客户原始资料，不保存联系人姓名、邮箱或电话，只保存不可逆企业引用哈希。
- 样品 `unit_cost` 是管理成本，不生成会计分录；发运引用是证据，不改写物流；反馈不生成或修改订单。

```text
source_records_copied = false
inquiry_source_pinned = true
authoritative_source_revalidated = true
requirement_self_approval = false
sample_self_approval = false
sample_cost_posts_finance = false
feedback_mutates_order = false
raw_customer_identifier_stored = false
customer_feedback_acknowledgement_required = true
```

## 3. 状态机与职责分离

- RFQ：`clarifying → sample-planned → sample-dispatched → feedback-pending → sample-accepted / sample-revision / sample-rejected`
- 技术需求：`pending-review → approved`
- 样品任务：`pending-approval → approved → dispatched → received`
- 客户反馈：`pending-acknowledgement → acknowledged`

需求编写人不得审核自己的技术需求；样品创建人不得审批自己的范围和管理成本；发运人不得代客户记录反馈；反馈记录人不得自行确认销售回执。未批准全部需求或未覆盖全部需求编号时，不得创建样品。

## 4. 权限、租户与审计

- `factory.convert.rfq.manage`
- `factory.convert.rfq.requirement.approve`
- `factory.convert.rfq.sample.approve`
- `factory.convert.rfq.sample.dispatch`
- `factory.convert.rfq.feedback.record`
- `factory.convert.rfq.feedback.acknowledge`

五张业务表都携带 `project_id`、`agent_path`、`tenant_id`、`client_id`、`plan_id`。所有写操作记录 `factory.rfq.*` 审计；跨项目查询必须为空。

## 5. 运营指标与完成条件

- RFQ 项目数、需求审核率、已批准样品数、已发运样品数、通过反馈数、反馈回执率。
- 完成条件：权威来源未漂移；需求、样品和反馈均满足异人审核；发运凭证存在；客户反馈哈希可复算；需求审核率和反馈回执率均为 100%；财务、物流和订单记录未被改写。

## 6. 迁移与回滚

迁移为 `ad4c7e2f9b61`，上游为 `9d3f6b1c8e50`。回滚前导出 RFQ 快照、需求审批、样品成本和范围审批、发运证据、客户反馈与回执。回滚只删除 RFQ/样品域投影和权限，绝不修改收入流、物流、财务、CRM 或订单。

## 7. 开发与验收顺序

1. Alembic 升级、回滚、再升级。
2. 专属测试覆盖异人审批、来源漂移、完整需求集合、租户隔离及零订单/财务写回。
3. TypeScript、平台蓝图契约、十五道门禁和生产构建。
4. 总部、代理和客户身份完成真实 API 全流程。
5. 数据库复算来源指纹、反馈哈希、证据、审计和权限。
6. 真实页面核对指标、左侧导航、面包屑和横向溢出。
