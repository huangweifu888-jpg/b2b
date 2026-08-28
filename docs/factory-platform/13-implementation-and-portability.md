# 客户实施中心与数据可迁移退出规范

客户实施中心把软件开通转化为业务落地、培训、验收和价值证明。蓝图事实源为 `FACTORY_PLATFORM_IMPLEMENTATION_STAGES` 与 `FACTORY_PLATFORM_PORTABILITY_RULES`；可运营实施记录由 `factory_implementation_programs` 与 `/api/v1/factory-platform/projects/{project_id}/implementation-programs` 提供。

每个客户计划同时只允许一个未完成实施周期。读取、创建、更新和阶段放行全部先通过数据库中的计划成员权限，记录租户、客户与计划边界，并使用 `expected_revision` 防止并发覆盖。创建、证据更新和阶段放行分别写入审计事件。迁移 `d8f1b4c7a205` 的回滚只移除实施控制记录和证据索引，不删除客户业务数据或源系统记录。

首个可运营控制面由 `factory_implementation_programs` 与 `/api/v1/factory-platform/projects/{project_id}/implementation-programs` 提供。每个实施周期绑定经数据库授权的客户计划及 `agent_path`、`tenant_id`、`client_id`、`plan_id`；同一计划同时只允许一个未完成周期，跨计划读取和更新会被拒绝。所有修改携带 `expected_revision` 并写入审计日志。

实施阶段只能按“7天就绪 → 30天通链 → 90天价值 → 完成”推进。每阶段必须补齐程序定义的标准证据且清零阻断；完成记录只读，不能通过直接改状态绕过门禁。迁移 `d8f1b4c7a205` 回滚时只删除实施控制记录及证据索引，不删除客户经营数据、权威系统记录或已经导出的文件。

## 7天就绪

目标是完成客户准备度评估、范围、责任、数据、权限和连接清单。

必须交付：准备度评分、项目角色、数据清单、连接器清单、权限矩阵、风险清单和30天黄金业务链计划。

程序证据键固定为：`readiness-score`、`project-roles`、`data-inventory`、`connector-inventory`、`permission-matrix`、`risk-register`、`thirty-day-goal`。

## 30天通链

目标是使用真实但受控的数据样本跑通第一条黄金业务链，并让客户关键角色独立完成操作。

必须交付：端到端演示、角色培训、问题闭环、试点报告、运行监控和回退演练。

程序证据键固定为：`end-to-end-demo`、`role-training`、`issue-closure`、`pilot-report`、`runtime-monitoring`、`rollback-drill`。

## 90天价值

目标是形成上线前后价值对比、使用健康、推广范围和续费扩展建议。

必须交付：价值证明、指标口径、客户确认、扩展方案、续费建议和下一轮负责人。

程序证据键固定为：`value-proof`、`metric-definition`、`customer-confirmation`、`expansion-plan`、`renewal-recommendation`、`next-owner`。

7/30/90天是标准节奏，不是无条件交付承诺。客户数据、连接器、合规评审或组织决策不满足条件时，必须记录阻断并重新确认计划。

阶段推进必须同时满足：本阶段全部标准证据已填写、阻断清零、修订号为最新。7天阶段固定校验7项准备证据，30天阶段固定校验6项通链与培训证据，90天阶段固定校验6项价值与客户确认。完成后的实施周期只读，不能静默重写历史证据。

## 数据可迁移与退出

1. **业务导出**：客户可按权限导出客户、产品、订单、服务及财务授权副本。
2. **素材迁移**：客户可迁移自有图片、视频、文档、内容和翻译资产。
3. **接口开放**：合同范围内提供版本化API和Webhook。
4. **停用保留**：明确只读期、导出期、保留期和删除期。
5. **禁止锁定**：不得通过隐藏字段、私有不可读格式或不合理拒绝导出来强迫续费。
6. **租户清退**：覆盖业务库、对象存储、搜索索引、缓存及依法管理的备份。

## 退出验收证据

- 导出字段字典及样例
- 文件数量、大小和校验值
- API版本及调用审计
- 权限与越权测试
- 数据保留和删除审批
- 对象存储、索引和缓存清理记录
- 客户接收确认
- 法规或合同要求的删除证明

可迁移不是削弱平台粘性，而是用可信、透明和长期价值替代数据锁定。
