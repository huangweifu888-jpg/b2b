# B2B 平台唯一源码入口

`00-platform-source` 是本软件工作区唯一可编辑源码。总部端、代理源、客户源、代理端、客户端和客户计划都从这里开发与验证；外层 `01`—`07` 只接收按规则生成的版本化角色成品，不保存第二套源码。

## 先从这里开始

| 事项 | 入口 |
|---|---|
| 工作区目录、数据和运行时边界 | [工作区总说明](../README.md) |
| 开发、架构、运维和历史文档 | [文档中心](./docs/README.md) |
| 七角色、发布包、六步流程和 1—7 台组合 | [部署中心](./deployment/README.md) |
| 源码保护和架构约束 | [AGENTS.md](./AGENTS.md) |
| 历史版本记录 | [VERSION_LOG.md](./VERSION_LOG.md) |

## 源码结构

| 目录 | 作用 |
|---|---|
| `frontend` | React、TypeScript、Vite 管理端与共享页面框架 |
| `backend` | FastAPI、数据模型、迁移、服务和接口 |
| `zbcx` / `dlcx` / `khcs` | 总部、代理、客户三类应用壳 |
| `modules` | 可复用业务能力，不复制到客户计划 |
| `shared` | 跨模块共享契约和公共实现边界 |
| `platform` | 租户注册、模板、发布、worker 等平台能力 |
| `deployment` | 七角色规则、服务器组合、策略和运行手册 |
| `release` | 发布工具和受控清单源码；不是正式发布成品仓库 |
| `docs` | 当前架构、运维手册、工厂蓝图和培训资料 |
| `tools` | 本地验证、迁移、演练和维护脚本 |

## 本地开发流程

1. 先阅读 [AGENTS.md](./AGENTS.md)，确认本次修改边界。
2. 编辑或执行批量自动化前，先运行源码锁检查。
3. 通过工作区根目录的 `local-runtime` 启动本地沙盘。
4. 完成与修改范围相符的前端、后端、共享契约和租户隔离验证。
5. 需要准备上线时，进入 [部署中心](./deployment/README.md)，先生成只读发布计划；不得把本目录整体上传服务器。

常用检查在 `frontend` 目录执行：

```powershell
npm run source-lock:check
npx tsc --noEmit
npm run verify:development-standard
```

后端测试在 `backend` 目录使用当前工作区配置的 Python 运行：

```powershell
python -m pytest
```

## 固定边界

- 只保留一份开发源码；不得在外层七角色目录继续手工开发。
- 数据库、上传素材、备份、日志、PID、密钥和本机依赖不进入源码发布包。
- 代理、租户、客户和计划必须保持 `agent_path`、`tenant_id`、`client_id`、`plan_id` 边界。
- 数据库结构变化必须使用 Alembic 迁移，并附回滚或隔离恢复说明。
- 正式服务器地址、凭据和生产路径只由部署环境配置提供，不写入源码或文档。
- 工作区换盘后通过相对目录和 PathRegistry 解析路径，不修改源码内的盘符常量。

