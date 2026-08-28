# 开发文档中心

本目录只负责解释产品、架构和运维规则。当前目录与部署事实以 [工作区总说明](../../README.md)、[源码入口](../README.md) 和 [部署中心](../deployment/README.md) 为准；历史文档中的旧盘符或旧目录不得作为当前执行命令。

## 1. 当前架构

- [七角色与 1—7 台服务器组合](../deployment/profiles/README.md)
- [客户运行单元部署手册](./architecture/customer-stamp-deployment-runbook.md)
- [租户授权矩阵](./architecture/tenant-authorization-matrix.md)
- [模板快照与租户迁移](./architecture/template-snapshot-tenant-migration.md)
- [请求安全控制](./architecture/request-security-controls.md)

涉及角色打包、服务器组合或发布顺序时，不在架构文档中另建一套规则，统一读取 [部署中心](../deployment/README.md) 的 YAML 事实源。

## 2. 发布与运维手册

- [发布预检](./architecture/release-preflight-runbook.md)
- [发布成品](./architecture/release-artifact-runbook.md)
- [发布放量与回滚](./architecture/release-rollout-runbook.md)
- [容器发布](./architecture/container-release-runbook.md)
- [数据库迁移](./architecture/database-migration-runbook.md)
- [专用 Worker](./architecture/dedicated-worker-runbook.md)
- [备份自动化](./architecture/backup-automation-runbook.md)
- [PostgreSQL 隔离恢复演练](./architecture/postgres-restore-drill-runbook.md)
- [观测与恢复](./architecture/observability-and-restore-runbook.md)
- [密钥管理](./architecture/secret-management-runbook.md)

完整生产启动顺序和失败边界见 [生产运行手册](../deployment/RUNBOOK.md)。部分早期手册仍保留旧电脑示例路径；执行时必须使用仓库相对命令、环境变量或当前 PathRegistry，不能照抄旧盘符。

## 3. 工厂平台蓝图

[工厂平台蓝图总入口](./factory-platform/README.md) 记录产品能力、三端治理、交付状态和运营契约。该目录属于产品与验收事实，不因首页未逐项链接而视为垃圾文件，也不得按文件数量批量删除。

## 4. 培训

- [运营培训包](./training/operations-training-pack.md)

电脑迁移不是服务器发布。换机时以[工作区总说明](../../README.md)和当前 `local-runtime` 入口为准，不使用已经退出的旧盘符工作包流程，也禁止覆盖当前工作区。

## 5. 历史证据

- [执行路线历史基线](./architecture/execution-roadmap.md)
- [版本历史](../VERSION_LOG.md)

这些文件保留决策背景或版本证据，但不拥有当前目录、部署组合和生产路径的解释权。需要更新现行规则时，应修改机器事实源及其当前入口说明，不回写历史版本日志。

## 文档维护原则

- 根 README 讲工作区，源码 README 讲开发，部署 README 讲发布；同一规则只在一个入口展开。
- 机器可读规则优先于手工表格；README 只做解释和链接。
- 示例命令使用仓库相对路径或环境变量，不写电脑盘符、真实域名、密码或密钥。
- 删除文档前先确认是否被测试、契约闸门、脚本或其他文档引用。
