# 受众营销运行契约

“受众营销”将已获同意的来源引用和同意回执转成可审计的营销受众工作单。它不保存手机号、邮箱、Cookie、设备号或其他原始个人数据；源系统仍然是客户数据和同意状态的唯一记录。

## 生命周期与权限

受众按 `draft → verified → activated` 流转，激活交接按 `pending → acknowledged` 流转。创建、独立核验、激活、接收分别需要 `factory.lead.audience.create`、`.verify`、`.activate`、`.acknowledge`。创建者不能核验自己建立的受众，激活者不能确认自己的交接；项目权限、乐观锁和审计事件共同阻止越权或并发覆盖。

## 三端共享边界

总部登记受众规则与来源引用，代理端独立检查同意回执，客户项目端确定受众责任人与接收。共享的是受众编号、市场范围、来源引用、回执引用、状态和交接清单指纹；不共享原始个人数据。契约固定 `raw_personal_data_stored=false`、`consent_receipt_required=true`、`external_audience_synced=false`、`external_ad_spend_dispatched=false`：本应用不自动同步任何外部广告受众、不创建投放，也不承诺转化效果。

## 迁移与回滚

迁移 `c1e8a4d9b607` 新增独立的 `factory_marketing_audiences` 投影，以避免与“标签同意”应用共用数据表；同时新增交接投影、四项权限和 `consent-audience` / `audience-activation-routed` 对象事件契约。回滚仅删除本迁移的营销投影、权限与契约，不删除既有同意记录、客户画像、审计日志或外部广告平台数据。
