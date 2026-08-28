# 客户资产与成功中心运营契约

应用 ID：`care.customer-success`；客户路由：`/customer-assets`；正式成熟度：`available`。

## 商业价值

本模块把已签收订单形成的装机资产、服务结果和临近保修的行动，转为可核验的客户成功复核与续费交接，而不是再复制一套 CRM 或修改订单。客户购买的是一条可追溯的长期价值链：资产来源、服务证据、风险判断、独立决策、续费承接和签收均能追责。因此服务团队可提前经营保修与维护价值，销售能接到被证据支撑的续费行动，管理者能区分真实客户健康和主观报表。

## 共享对象、三端边界与权限

冻结对象为 `customer-success-review`，其最小字段是 `tenantId`、`reviewId`、`assetId`、`assetRevision`、`sourceFingerprint`、`healthScore`；冻结事件为 `customer-success-handoff-released`。平台蓝图、栏目配置、运营市场、左侧导航和页面锁定器只消费同一 `care.customer-success`、`/customer-assets` 与 `deliveryStatus` 投影。

| 动作 | 权限 | 不可绕过的约束 | 审计 |
| --- | --- | --- | --- |
| 创建复核 | `factory.care.success.create` | 资产必须属于本项目、已激活且已有受控续费行动；固定资产修订和来源指纹 | `factory_customer_success_review_created` |
| 独立复核 | `factory.care.success.review` | 复核人不能是创建人；乐观修订校验 | `factory_customer_success_review_reviewed` |
| 独立批准 | `factory.care.success.approve` | 批准人不能是创建人或复核人 | `factory_customer_success_review_approved` |
| 交接续费经营 | `factory.care.success.handoff` | 仅批准后创建不可变交接包，不直接写入续费、CRM、报价或订单 | `factory_customer_success_handoff_released` |
| 独立签收 | `factory.care.success.acknowledge` | 签收人不能是交接发布人 | `factory_customer_success_handoff_acknowledged` |

总部、服务商、客户三端在真实生产会话下分别承担创建、复核、批准/发布及签收；本地演示会话仅用于验证同一权限与异人约束。资产、服务工单、订单、续费商机、报价、订单、发票、支付和身份资料均保持原系统权威，不会被本模块覆盖。

## 生命周期、迁移与回滚

复核生命周期为 `draft → reviewed → approved → handed-off`；交接生命周期为 `pending → acknowledged`。迁移 `d5f9b2e7a103` 创建仅限客户成功的复核、交接、证据、项目/租户索引、权限及冻结对象/事件契约。回滚仅移除这些投影、权限与契约；执行前导出复核、签收和审计证据，绝不删除客户资产、服务记录、续费机会、订单、财务或身份数据。

## 正式可用验收

`tools/run_customer_success_api_acceptance.ps1` 不提供种子或后门，只消费已有的“已激活 + 受控续费行动”资产，按总部、服务商、客户真实本地会话完成创建、复核、批准、交接和异人签收。`tools/inspect_customer_success_acceptance.py` 从数据库独立核对来源指纹、资产修订、创建/复核/批准/签收的异人职责、冻结交接证据、签收与五类审计。页面验收要求 `/customer-assets` 使用真实 API、展示创建/复核/批准/交接/签收控件，1280px 无横向溢出；单测、TypeScript、共享契约门禁和生产构建同时通过才维持 `available`。
