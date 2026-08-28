# AI计划与数字资产可用性契约

应用：`identity.digital-assets`；迁移：`0f7d1a6b2c94`；当前状态：`available`。

## 商业闭环与共享契约

闭环为：计划草稿 → AI建议 → 异人复核 → 域名/商标/授权资产登记 → 异人批准权利 → 异人批准计划 → 受控交接证据 → 异人批准可用性。对象 `digital-asset-plan` 与事件 `digital-assets-released` 必须保持 frozen，记录始终带有 `project_id + agent_path + tenant_id + client_id + plan_id`。业务计划引用另用 `source_plan_id`，避免覆盖租户计划边界。

AI建议仅是可追溯的输入，`ai_can_approve = false`。应用不保存注册商密钥（`registrar_secret_stored = false`），不自动购买、绑定或转移域名（`domain_purchase_or_transfer_automated = false`），不发布站点（`website_published = false`），也不覆盖受保护的站点/模板/客户配置（`protected_site_configuration_overwritten = false`）。总部、代理来源端、客户来源端均消费同一对象和事件契约；交接只发布版本化引用，不反向改写来源记录。

## 权限、审计、迁移与回滚

计划和登记由 `factory.identity.digital-assets.manage` 控制；AI建议复核、资产权利批准、计划批准和交接批准分别由专用权限控制。每个写操作都校验项目访问和项目权限，并写入审计事件。发起人不能复核自己的AI建议、批准自己登记的资产、批准自己的计划或批准自己准备的交接。

迁移创建五张数字资产投影、五项权限及两个冻结共享契约。回滚只移除这些投影、权限和契约；绝不购买、绑定、转移、删除域名，绝不发布站点或改写客户站点、模板和保护配置。迁移演练须按 `f31c7a9b2d60 → 0f7d1a6b2c94 → f31c7a9b2d60 → 0f7d1a6b2c94` 验证。

## 当前版本验收

三角色 API 验收完成计划、AI建议异人复核、域名权利异人批准、计划异人批准、受控交接和独立可用性批准。真实页面验收为 `live`，包含八个关键操作入口、真实记录状态和无横向溢出检查。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\run_digital_assets_api_acceptance.ps1
$pythonCommand = if ($env:PLATFORM_PYTHON) { $env:PLATFORM_PYTHON } else { 'python' }
& $pythonCommand -m pytest .\backend\tests\test_factory_digital_assets.py -q
```
