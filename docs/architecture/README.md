# 架构与运行手册索引

本目录保存跨模块架构、发布、安全、数据和生产运维手册。工作区入口见 [开发文档中心](../README.md)，七角色及 1—7 台组合见 [源码与部署中心](../../deployment/README.md)。

## 执行约定

- 手册命令默认从 `00-platform-source` 仓库根运行。
- `python` 表示当前发行环境管理的 Python；需要显式选择时通过 `PLATFORM_PYTHON` 配置，不把解释器绝对路径写进文档。
- 环境文件、资源契约、变更记录、成品和备份通过命令参数或受保护环境变量传入，不能放进源码。
- 本地数据路径由工作区根和 PathRegistry 解析；生产路径由角色环境配置提供。
- 手册中的验证命令默认只读或自检。涉及迁移、发布、恢复和外部服务时，必须再按对应审批与回滚边界执行。

## 1. 总体架构与租户边界

- [七角色规则](../../deployment/role-definitions/README.md)
- [渐进模块化架构：12 类、三端组合与角色制品](./progressive-module-architecture.md)
- [普通页面工厂：统一登记、接入、检查与恢复默认](./page-factory.md)
- [1—7 台服务器组合](../../deployment/profiles/README.md)
- [客户运行单元部署](./customer-stamp-deployment-runbook.md)
- [模板快照与租户迁移](./template-snapshot-tenant-migration.md)
- [租户授权矩阵](./tenant-authorization-matrix.md)
- [请求安全控制](./request-security-controls.md)
- [内容扫描生产边界](./content-scanner-production-runbook.md)
- [本地业务流程](./local-business-flow-runbook.md)

## 2. 发布、制品与上线

- [发布预检](./release-preflight-runbook.md)
- [发布成品](./release-artifact-runbook.md)
- [发布放量与回滚](./release-rollout-runbook.md)
- [容器发布](./container-release-runbook.md)
- [预发布资源与发布执行器](./staging-resource-runbook.md)
- [预发布发布演练](./staging-release-drill-runbook.md)
- [正式环境执行清单](./live-environment-execution-checklist.md)
- [运维就绪](./operations-readiness-runbook.md)

完整生产启动顺序另见 [deployment/RUNBOOK.md](../../deployment/RUNBOOK.md)。

## 3. 数据、任务、观测与恢复

- [数据库迁移](./database-migration-runbook.md)
- [专用 Worker](./dedicated-worker-runbook.md)
- [Redis 限流](./redis-rate-limit-runbook.md)
- [健康监控](./health-monitor-runbook.md)
- [备份自动化](./backup-automation-runbook.md)
- [PostgreSQL 隔离恢复演练](./postgres-restore-drill-runbook.md)
- [观测与恢复演练](./observability-and-restore-runbook.md)
- [迁移、域名、成本与连续性](./migration-domain-cost-dr-runbook.md)

## 4. 安全、供应链与外部服务

- [密钥管理](./secret-management-runbook.md)
- [依赖 SBOM](./dependency-sbom-runbook.md)
- [安全与容量就绪](./security-capacity-readiness-runbook.md)
- [安全、集成与生命周期](./security-integration-and-lifecycle-runbook.md)
- [外部服务切换](./external-service-cutover-runbook.md)
- [基础设施与支付开通](./infrastructure-payments-provisioning-runbook.md)
- [身份、计费、质量与运营](./identity-billing-quality-operations-runbook.md)

## 5. 历史基线

[execution-roadmap.md](./execution-roadmap.md) 保留早期实施顺序和决策背景，不拥有当前目录或部署路径解释权。当前执行必须回到本索引、工作区 README、PathRegistry 和部署 YAML。

## 维护原则

- 新增手册必须放入一个明确分类并从本页链接。
- 同一服务器映射、角色清单或发布顺序不得在多个手册建立不同副本。
- 现行 Markdown 禁止电脑盘符绝对路径和旧的仓库内固定虚拟环境路径。
- 历史版本证据保留在 `VERSION_LOG.md`，不批量改写，也不作为当前命令来源。
- 提交前运行 `python .\tools\verify_active_documentation_paths.py`。
