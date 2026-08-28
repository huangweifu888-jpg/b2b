# 竞品价格情报商业可用契约

应用：`identity.competitive-pricing`；迁移：`e18ab6d3f205`；状态：`available`。

## 业务闭环

`价格观察 → 竞品快照 → 独立核验 → 价格带决策 → 独立复核 → 发布证据 → 独立批准`。每一项价格带决策至少需要三份已核验的竞品快照，并固定低位、中位、高位到岸价格与价格指数。

输出只用于产品、市场和销售决策：`formal_quote_created = false`、`finance_price_master_mutated = false`。任何客户正式报价仍必须由 CPQ 的独立权限和审批流程创建，财务价目仍由财务权威系统维护。

## 可售门禁与边界

来源只保存引用、版本、观测时间和哈希，不复制外部来源记录、不保存连接器密钥。录入者不能核验自己的快照；决策作者不能复核；发布准备者不能批准。发布需同时具有 `customer_trial_reference`、`role_training_reference`、`issue_closure_reference`、`monitoring_reference`、`rollback_reference`，并有未到期的支持责任。

对象契约 `competitive-price-watch` 和事件契约 `competitive-price-released` 必须保持 frozen。所有对象带 `project_id + agent_path + tenant_id + client_id + plan_id`，所有写操作记录审计事件。

## 迁移、回滚与当前版本验收

迁移 `e18ab6d3f205` 创建五张竞品价格投影、四项权限和两个冻结契约。回滚仅删除这些投影、权限和契约，不改动 CPQ、财务价目或外部来源。

已验证 `d07fa5c2e194 → e18ab6d3f205 → d07fa5c2e194 → e18ab6d3f205`。2026-08-05 真实 API 验收使用总部、代理、客户三角色完成 11 条业务证据：3 个报价快照全部核验，价格指数为 105.00，建议为 `match`，发布为 `available`。

```powershell
$pythonCommand = if ($env:PLATFORM_PYTHON) { $env:PLATFORM_PYTHON } else { 'python' }
& $pythonCommand -m pytest .\backend\tests\test_factory_competitive_pricing.py -q
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\run_competitive_pricing_api_acceptance.ps1
Push-Location .\frontend
npm run build
Pop-Location
```
