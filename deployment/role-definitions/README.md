# 七个固定部署角色

本目录的 `role-01.yaml` 至 `role-07.yaml` 是角色打包的唯一机器事实源。每个文件定义源码白名单、排除项、依赖、成品目录、环境模板、健康检查、部署顺序和回滚策略。

| ID | 角色 | 核心职责 | 依赖 | 成品根目录 | 规则 |
|---|---|---|---|---|---|
| `01` | 总部与源控制 | 总部端、代理源、客户源、租户注册、模板与发布控制 | `06` | `../01-hq-source-control/releases` | [role-01.yaml](./role-01.yaml) |
| `02` | 代理运行端 | 多代理、多级代理运行和代理路径隔离 | `01`、`06` | `../02-agency-runtime/releases` | [role-02.yaml](./role-02.yaml) |
| `03` | 客户与计划运行端 | 多客户端、客户端多计划及四级上下文隔离 | `01`、`02`、`06` | `../03-client-plan-runtime/releases` | [role-03.yaml](./role-03.yaml) |
| `04` | 素材与异步任务 | 上传隔离、扫描、派生、构建、批量发布和持久任务 | `06` | `../04-content-worker/releases` | [role-04.yaml](./role-04.yaml) |
| `05` | 公网入口与观测 | 域名、HTTPS、反向代理、限流、日志、指标和告警 | `01`—`04` | `../05-edge-observability/releases` | [role-05.yaml](./role-05.yaml) |
| `06` | 数据服务 | PostgreSQL、Redis、私有对象存储和受控迁移 | 无 | `../06-data-services/releases` | [role-06.yaml](./role-06.yaml) |
| `07` | 备份与灾难恢复 | 异地备份、完整性校验、隔离恢复演练和灾难切换证据 | 无 | `../07-backup-disaster-recovery/releases` | [role-07.yaml](./role-07.yaml) |

表中的成品根目录相对 `00-platform-source` 解析到外层工作区。它们是构建目标，不表示目录或正式发布包已经生成。

## 通用打包边界

- `sourceIncludes` 是允许进入候选角色包的源码范围。
- `sourceExcludes` 在任何情况下都优先于包含规则。
- `local-data`、`local-runtime`、真实 `.env`、数据库文件、素材原件、日志、PID、缓存和备份负载不得进入角色包。
- 环境模板只能列变量名和安全占位值，不得包含真实生产凭据。
- 每个成品必须记录角色 ID、版本、源码提交、manifest、校验值、依赖和回滚版本。
- 健康检查未通过时不得把候选版本标记为正式生效。

## 交付工作区

外层七个目录是角色交付区，不是源码分支：

- [01 总部与源控制](../../../01-hq-source-control/README.md)
- [02 代理运行端](../../../02-agency-runtime/README.md)
- [03 客户与计划运行端](../../../03-client-plan-runtime/README.md)
- [04 素材与异步任务](../../../04-content-worker/README.md)
- [05 公网入口与观测](../../../05-edge-observability/README.md)
- [06 数据服务](../../../06-data-services/README.md)
- [07 备份与灾难恢复](../../../07-backup-disaster-recovery/README.md)

服务器放置方式见 [1—7 台组合](../profiles/README.md)，完整流程见 [源码与部署中心](../README.md)。

