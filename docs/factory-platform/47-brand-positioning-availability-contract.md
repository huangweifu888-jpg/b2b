# 品牌定位与网站风格可用性契约

应用：`identity.brand`；迁移：`f31c7a9b2d60`；当前状态：`available`。

## 业务闭环与写入边界

品牌策略的闭环是：品牌规范草稿 → 两条可验证主张 → 异人核验 → 异人批准不可变版本 → 当前版本证据 → 异人批准发布。输出是供内容、销售和网站风格使用的版本化指导，`website_published = false`、`protected_brand_configuration_overwritten = false`：不会自动发布站点，也不会覆盖客户已经保护的品牌配置。

## 发布门禁、契约与回滚

每条主张固定证据引用与哈希；录入者不能自行核验，作者不能批准自己的规范，发布准备者不能自行批准。发布同时需要客户试用、角色培训、问题闭环、运行监控、回滚演练和未到期支持责任。对象 `brand-profile` 与事件 `brand-released` 必须 frozen，所有记录携带项目、代理、租户、客户与计划边界，并记录审计事件。

迁移 `f31c7a9b2d60` 创建五张品牌投影、四项权限和两个冻结契约。回滚仅移除这些品牌投影、权限和契约；绝不发布网站、改写客户品牌配置、内容版本或模板。

当前版本的三角色 API 验收已获得已启用规范、两条已独立核验的主张和正式可用发布。真实页面验收为 `live`、四条业务记录、六个核心操作入口且无横向溢出。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\run_brand_api_acceptance.ps1
$pythonCommand = if ($env:PLATFORM_PYTHON) { $env:PLATFORM_PYTHON } else { 'python' }
& $pythonCommand -m pytest .\backend\tests\test_factory_brand.py -q
```
