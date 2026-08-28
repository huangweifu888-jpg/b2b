# B2B 订货与 B2C 结账运营契约

## 1. 客户买点

订货结账把工厂的企业报价接受、消费者商品结账、买方条款、支付凭证和 OMS 订单确认连接为同一条可审计交易链。B2B 使用已接受 CPQ 报价，B2C 使用带权威价格和库存引用的已验证商品；两种模式共享治理、指标和回执，但不混淆各自权威来源。

## 2. 权威来源与隐私边界

- B2B 只接收带 `order_intent_id` 的已接受 CPQ 报价；B2C 只接收 `connector-reference` 且非缺货的已验证渠道商品。
- 每次条款、支付、订单意向和回执前重新校验来源修订、商业快照和哈希；来源漂移立即阻断。
- 只保存买方、采购引用、接受证据和支付令牌的不可逆哈希，不保存姓名、邮箱、电话、地址、银行卡或支付秘密。
- 支付意向只证明外部凭证，不扣款、不记账；结账端只提交订单意向，不能自行确认订单。

```text
source_records_copied = false
authoritative_commercial_source_pinned = true
source_revalidated_before_each_action = true
raw_buyer_identifier_stored = false
payment_secret_stored = false
payment_charge_created = false
checkout_direct_order_confirmation = false
terms_self_review = false
payment_self_verification = false
immutable_order_intent_manifest = true
oms_acknowledgement_required = true
```

## 3. 状态机与职责分离

- 结账：`draft → terms-pending → terms-approved → payment-pending → payment-verified → order-submitted → order-confirmed / order-rejected`
- 条款：`pending-review → approved / rejected`
- 支付：`pending-verification → verified`
- 订单交接：`pending-acknowledgement → confirmed / rejected`

结账创建人不得代买方接受条款；条款记录人不得自行审核；支付发起人不得自行核验；订单意向提交人不得自行回执。B2B 确认必须匹配同一报价、同一意向、同一金额币种且状态为 `confirmed` 的权威 OMS 订单。B2C 的外部 OMS 回执必须携带权威系统和决定引用。

## 4. 权限、租户与审计

- `factory.convert.commerce.manage`
- `factory.convert.commerce.terms.review`
- `factory.convert.commerce.payment.verify`
- `factory.convert.commerce.order.submit`
- `factory.convert.commerce.order.acknowledge`

五张业务表都携带 `project_id`、`agent_path`、`tenant_id`、`client_id`、`plan_id`。所有写操作记录 `factory.commerce.*` 审计，跨项目查询必须为空。

## 5. 指标与完成条件

- 结账请求数、B2B 订货数、B2C 结账数、条款审核率、支付核验率、订单确认率。
- 完成条件：来源未漂移；条款与支付均异人审核；意向清单哈希可复算；OMS 独立回执；B2B 权威订单可追溯；无支付扣款或结账端订单确认；三项审核/核验/确认率均达到 100%。

## 6. 迁移与回滚

迁移为 `be5d8f3a0c72`，上游为 `ad4c7e2f9b61`。回滚前导出商业快照、条款接受、支付令牌哈希、订单意向清单及 OMS 回执。回滚只删除 Commerce 投影和权限，绝不修改 CPQ、渠道、支付、财务、库存或权威 OMS 数据。

## 7. 验收顺序

1. Alembic 升级、回滚、再升级。
2. 专属测试覆盖 B2B、B2C、异人审核、来源漂移、OMS 精确匹配和租户隔离。
3. 平台蓝图、十五道门禁和生产构建。
4. 总部、代理、客户身份完成真实 API 及权威 OMS 确认。
5. 数据库复算来源、条款、支付、意向清单、证据、审计和权限。
6. 真实页面核对指标、左栏、面包屑与横向溢出；最后执行 72/72 零占位审计。
