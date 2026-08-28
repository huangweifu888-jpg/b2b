# 市场雷达商业可用契约

应用：`identity.market-radar`；当前迁移：`d07fa5c2e194`；交付状态：`available`。

## 商业闭环

`市场扫描 → 来源信号 → 独立核验 → 进入决策 → 独立复核 → 发布证据 → 独立批准`。五类信号固定为 `demand`、`growth`、`competition`、`entry-barrier`、`channel-fit`，权重分别为 25%、20%、15%、20%、20%。评分只说明进入优先级，不代替财务预算、法务合规或渠道合同审批。

## 可售门禁

当前版本必须同时提供 `customer_trial_reference`、`role_training_reference`、`issue_closure_reference`、`monitoring_reference`、`rollback_reference`，并登记未来支持截止时间。信号记录人不能核验自己的信号，决策作者不能复核自己的决策，发布准备人不能批准自己的发布。对象契约 `market-entry-scan` 与事件契约 `market-entry-released` 必须保持 frozen。

## 数据和权限边界

市场雷达只保存来源引用、来源版本、观测时间和哈希，不复制来源数据库记录，不保存连接器密钥。所有对象带 `project_id + agent_path + tenant_id + client_id + plan_id`，查询按项目隔离。权限为：

- `factory.identity.market-radar.manage`
- `factory.identity.market-radar.signal.verify`
- `factory.identity.market-radar.decision.review`
- `factory.identity.market-radar.release.approve`

所有写操作记录审计事件。客户试用引用是当前版本发布门禁；本地验收角色只证明程序门禁可执行，不等同于外部客户签署的商业背书。

## 迁移、回滚与验收

升级创建五张市场雷达投影表、四项权限和两个冻结契约。降级仅删除这些投影、权限和契约，不修改产品、客户、连接器或外部来源数据。已验证：`cf6e9a4b1d83 → d07fa5c2e194 → cf6e9a4b1d83 → d07fa5c2e194`。

验收命令：

```powershell
$pythonCommand = if ($env:PLATFORM_PYTHON) { $env:PLATFORM_PYTHON } else { 'python' }
& $pythonCommand -m pytest .\backend\tests\test_factory_market_radar.py -q
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\run_market_radar_api_acceptance.ps1
Push-Location .\frontend
npm run build
Pop-Location
```

2026-08-03 当前版本真实 API 验收通过：三角色会话完成 15 条业务证据，机会分 81.60，发布状态 `available`，专项测试 2 项通过，迁移升降级及生产构建通过。
