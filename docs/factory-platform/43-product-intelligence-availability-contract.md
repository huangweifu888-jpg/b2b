# 产品分析商业可用契约

## 1. 业务目标与购买价值

`identity.product-intelligence` 把“凭经验选品”变成可追溯的产品投资决策：工厂在投入研发、备料、内容和广告预算前，用同一研究项目核验需求、毛利、增长、竞争和工厂能力五类信号，并由不同角色完成来源核验、组合评估和正式发布审批。

客户购买的不是一张静态关键词表，而是一条能持续复算、能追责、能回滚的决策链。市场数据更新时，系统可以定位受影响的评估和版本；销售、产品、财务与工厂管理层使用同一份已批准证据，减少口径争议和错误投入。

## 2. 真实业务闭环

```text
研究立项
  → 五类带来源版本的信号
  → 异人逐项核验
  → 加权机会评估
  → 异人评估审核
  → 绑定当前版本六类商业证据
  → 异人发布批准
  → product-opportunity-released
```

五类信号固定为 `demand`、`margin`、`growth`、`competition`、`capability-fit`。缺少任一信号、来源哈希变化、核验人与记录人相同、评估人与审核人相同、发布人与批准人相同、支持期限过期或六类证据缺失时，正式可用发布必须失败。

## 3. 商业可用证据

每个正式版本必须绑定且保留以下六个引用：

- `end_to_end_demo_reference`：真实角色端到端演示；
- `role_training_reference`：角色培训与操作确认；
- `issue_closure_reference`：试点问题全部闭环；
- `pilot_report_reference`：限定租户、区域和连接器的试点结论；
- `runtime_monitoring_reference`：运行监控与告警证据；
- `rollback_drill_reference`：迁移回滚与业务恢复演练。

`available` 是“当前发布版本”承诺，不是永久标签。支持期限失效、来源或评估漂移、对象/事件契约解冻、重大回归失败时，应用必须回退到 `pilot`，销售端也必须同步停止“正式可用”表述。

## 4. 数据与系统边界

- 权威市场和经营数据保留在来源系统，本应用只保存来源引用、版本、观察时间和不可变哈希，不复制连接器密钥。
- PLM 仍是产品工程事实源；产品分析不得修改 BOM、工艺、规格或工程版本。
- 研究、信号、评估、发布和证据全部包含 `project_id`、`agent_path`、`tenant_id`、`client_id`、`plan_id`，访问按项目和角色权限过滤。
- 对象契约 `product-opportunity-study` 与事件契约 `product-opportunity-released` 必须处于 `frozen`，下游内容、获客和经营决策只消费已发布版本。
- 所有写操作进入 `factory.product-intelligence.*` 审计链；发布清单和评估输入均可重新计算哈希。

## 5. 权限与职责分离

| 权限 | 用途 |
| --- | --- |
| `factory.identity.product-intelligence.manage` | 建立研究、记录信号、生成评估、准备发布 |
| `factory.identity.product-intelligence.signal.verify` | 独立核验来源信号 |
| `factory.identity.product-intelligence.assessment.review` | 独立审核机会评估 |
| `factory.identity.product-intelligence.release.approve` | 独立批准当前版本正式可用 |

系统必须验证具体人员不同，不能仅依靠按钮隐藏实现职责分离。

## 6. 迁移与回滚

迁移版本为 `cf6e9a4b1d83`，前置版本为 `be5d8f3a0c72`。升级创建五张产品分析投影表、四项角色权限、对象契约和事件契约；升级、降级、再升级必须在共享数据库副本上通过。

降级只删除本迁移创建的产品分析研究、信号、评估、发布、证据投影及对应权限和契约，不删除或改写 PLM、来源连接器、客户、订单、财务或其他应用记录。执行降级前必须导出正式发布证据；回退后应用状态恢复为 `pilot`，不得继续宣称当前版本正式可用。

## 7. 验收与可复验证据

```powershell
$pythonCommand = if ($env:PLATFORM_PYTHON) { $env:PLATFORM_PYTHON } else { 'python' }
& $pythonCommand -m pytest .\backend\tests\test_factory_product_intelligence.py -q

powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\run_product_intelligence_api_acceptance.ps1
$databaseFile = (Resolve-Path '..\local-data\database\platform.sqlite3').Path
& $pythonCommand .\tools\inspect_product_intelligence_acceptance.py --database $databaseFile
```

最终验收还必须包含：全量工厂回归、15 项开发规范门禁、生产构建、真实浏览器页面、当前导航与面包屑、1280 像素视口无横向溢出，以及程序蓝图中该应用的显式 `deliveryStatus: "available"`。

## 8. 2026-08-03 当前版本验收记录

- 共享数据库迁移：`be5d8f3a0c72 → cf6e9a4b1d83 → be5d8f3a0c72 → cf6e9a4b1d83` 通过，正式共享库当前为 `cf6e9a4b1d83`。
- 真实角色链：总部记录研究和五类信号，代理逐项核验，客户审核评估，总部准备发布，代理独立批准。
- 当前发布：`PIR-1-20260803064854705633-A508F5`，版本 `2026.08.20260803144854339`，状态 `available`，支持期限至 2027-01-30。
- 数据证据：五类信号 100% 核验，机会评分 81.90，15 条业务证据、15 条平台审计，评估与发布哈希均独立复算通过。
- 回归与构建：107 项工厂/租户测试通过，15 项开发规范门禁通过，Vite 生产构建 2824 个模块通过。
- 真实页面：`/zb/client-source/product-analysis` 为 `live / available`，指标 `1 / 100% / 1 / 1 / 81.90`，7 条记录状态为 `verified × 5 / approved / available`；导航 `aria-current=page`，1280/1280 无横向溢出。

因此仅 `identity.product-intelligence` 在当前证据范围内升级为正式可用。平台总状态为 `available=1 / pilot=71 / planned=0`，不得据此宣称其他 71 项已经正式商用。
