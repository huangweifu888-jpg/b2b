# 经营健康驾舱运营契约

## 1. 应用定位

`decision.cockpit` 是经营事实的只读决策层，不是第二套 CRM、ERP、QMS、OMS 或财务台账。它从报价、订单、交付、质量、装机资产、服务、RMA、VOC/NPS、回款和伙伴系统读取权威记录，生成带来源水位的不可回写快照。驾舱只允许下钻、认领异常和创建责任任务，不允许直接改写来源事实。

## 2. V1 指标口径

| 维度 | 指标 | 分子 / 分母 | 目标 | 权重 |
| --- | --- | --- | ---: | ---: |
| 需求 | 报价转订单率 | 已确认及后续状态订单 / 报价 | 60% | 15 |
| 交付 | 订单交付完成率 | 已交付订单 / 非驳回订单 | 85% | 15 |
| 质量 | 质量放行率 | 已放行检验 / 全部检验 | 95% | 15 |
| 客户 | 客户问题闭环率 | 已解决服务单、已关闭 RMA 与 VOC / 对应总量 | 90% | 15 |
| 客户 | 客户资产稳定率 | 活跃且无需立即续约行动资产 / 全部资产 | 85% | 10 |
| 现金 | 开票回款率 | 已回款金额 / 已开票金额 | 95% | 15 |
| 生态 | 伙伴开通率 | 已开通伙伴 / 全部伙伴 | 80% | 5 |
| 治理 | 经营数据覆盖率 | 有有效分母的业务指标 / 七项业务指标 | 80% | 10 |

无权威记录的指标必须显示“无数据”，不得以 0%、100% 或模拟数据掩盖缺口。总健康分只对可用指标加权，同时由“经营数据覆盖率”对缺数负责。

## 3. 固定状态机

- 快照：`published`。快照生成后不可覆盖；同租户的外部快照引用不可重复。
- 异常：`open → acknowledged → task-assigned → pending-verification → resolved`。
- 责任任务：`assigned → in-progress → completed → verified`。
- 完成人与验证人必须独立，验证失败不关闭异常。
- 所有写操作使用 `expected_revision` 乐观锁，防止并发覆盖。

## 4. 权威边界和证据

- `factory_health_cockpit_snapshots` 保存指标、分子分母、来源表和来源水位。
- `factory_health_cockpit_alerts` 保存阈值异常及责任状态。
- `factory_health_responsibility_tasks` 保存行动计划、完成证据和独立验证。
- `factory_health_cockpit_evidence` 是追加式证据，固定记录快照生成、认领、分派、开始、完成和验证。
- 驾舱不反写 `factory_cpq_quotes`、`factory_fulfillment_orders`、`factory_quality_inspections`、`factory_customer_assets`、`factory_asset_service_tickets`、`factory_warranty_rma_cases`、`factory_voice_of_customer_cases`、`factory_revenue_flow_runs` 或 `factory_partner_accounts`。

## 5. 权限和审计

| 权限 | 用途 |
| --- | --- |
| `factory.decision.health-cockpit.refresh` | 生成只读经营快照 |
| `factory.decision.health-cockpit.alert.manage` | 认领异常并设置责任人与时限 |
| `factory.decision.health-cockpit.task.manage` | 分派、开始和完成责任任务 |
| `factory.decision.health-cockpit.task.verify` | 独立复核证据并关闭异常 |

审计事件固定为：`factory_health_cockpit_refreshed`、`factory_health_alert_acknowledged`、`factory_health_task_assigned`、`factory_health_task_started`、`factory_health_task_completed`、`factory_health_task_verified`。

## 6. API 契约

- `GET /api/v1/factory-platform/projects/{project_id}/health-cockpit`
- `POST .../health-cockpit/refresh`
- `POST .../health-cockpit/alerts/{alert_id}/acknowledge`
- `POST .../health-cockpit/alerts/{alert_id}/tasks`
- `POST .../health-cockpit/tasks/{task_id}/start`
- `POST .../health-cockpit/tasks/{task_id}/complete`
- `POST .../health-cockpit/tasks/{task_id}/verify`

所有对象携带 `project_id`、`agent_path`、`tenant_id`、`client_id` 和 `plan_id`，读取与写入均校验项目权限。

## 7. 商业买点与运营验收

客户购买的不是一张装饰性大屏，而是一套能回答“数字来自哪里、谁负责、何时完成、谁独立确认”的经营执行系统：

1. 每项指标能下钻到权威来源和数据水位，避免多个部门各说一套数字。
2. 没有数据会成为显式治理异常，不能用漂亮图表掩盖。
3. 异常必须绑定责任人、截止时间、行动方案和证据。
4. 完成与验证分权，防止责任人自行宣布问题解决。
5. 新快照保留历史口径和结果，后续可比较趋势、追责与复盘。

商业验收必须证明：八项指标含真实分子分母；缺数显式显示；至少一个异常完成认领、分派、执行、完成与独立验证；六个审计事件与六类证据一致；来源业务记录未被驾舱修改。

## 8. 迁移与回滚

迁移 `d3bf5c7e1a92_factory_health_cockpit.py` 新增四张驾舱表和四项系统角色权限。回滚只删除派生快照、异常、责任任务、驾舱证据和对应权限，不删除或修改任何报价、订单、质量、资产、服务、VOC、RMA、伙伴、开票或回款事实。
