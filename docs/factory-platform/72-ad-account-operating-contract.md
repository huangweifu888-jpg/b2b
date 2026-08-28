# 广告账户运行契约

“广告账户”把国内外投放账户的业务标识、权限交接和审计记录放进租户项目范围内管理。它只保存保险库引用 `vault_reference`，不保存 Google、Meta、LinkedIn、TikTok、百度等平台的登录凭证或密钥。

## 生命周期与权限

账户按 `draft → verified → routed` 流转；交接单按 `pending → acknowledged` 流转。创建、独立核验、交接、接收分别需要 `factory.lead.ad-accounts.create`、`.verify`、`.route`、`.acknowledge`。同一操作者不能核验自己创建的账户，也不能接收自己发起的交接；所有写入以项目权限、乐观锁版本和审计事件为边界。

## 三端共享边界

总部登记规范和账户引用，代理端执行独立核验，客户项目端选择交接责任人并确认接收。三端共享账户编号、平台、市场范围、保险库引用、交接清单指纹和状态，但不共享任何平台凭证。契约固定：`platform_credentials_stored=false`、`external_account_enabled=false`、`external_ad_spend_dispatched=false`；本应用不会自动启用外部账户、创建广告、消耗预算或承诺投放效果。

## 迁移与回滚

迁移 `b4e1f7c9d023` 新增广告账户、交接投影、四项权限和 `ad-account-registry` / `ad-account-routed` 对象事件契约。回滚仅删除本迁移新增的投影、权限和契约，不会删除既有审计日志、客户项目、保险库中原有密钥或任何外部广告账户。
