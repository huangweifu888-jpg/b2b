# 预算与归因运行契约

“预算出价与归因”将已批准的财务管理预算与已发布的归因贡献分析组合为可审计的营销预算分配结论。它不充当财务总账，也不直接写入广告平台预算、竞价或投放。

## 生命周期与权限

预算分配按 `draft → verified → accepted` 流转。创建、独立核验和独立确认分别需要 `factory.lead.budget-attribution.create`、`.verify`、`.accept`。创建人不能核验，创建人与核验人不能确认；乐观锁、项目权限和审计事件共同阻止越权或并发覆盖。

## 三端可视化共享边界

总部端创建分配草案，代理源端独立核验预算与归因快照，客户项目端确认营销结论。三端共享预算凭证引用、归因运行编号、金额、币种、状态和不可变清单指纹；不共享外部广告凭据。契约固定 `finance_budget_source_required=true`、`published_attribution_required=true`、`external_ad_budget_changed=false`、`automatic_bid_changed=false`、`incrementality_guaranteed=false`：预算必须来自已批准财务凭证，归因必须来自已发布分析，但任何外部广告改动仍由人工在广告平台执行。

## 迁移与回滚

迁移 `e8b4c1d9a507` 新增 `factory_marketing_budget_allocations`，授予三项项目权限，并登记 `marketing-budget-allocation` / `budget-allocation-accepted` 对象事件契约。回滚仅删除本模块投影、权限与契约；不会删除财务预算凭证、归因分析、审计日志或任何外部广告平台数据。
