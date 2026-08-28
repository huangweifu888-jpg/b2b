# 1—7 台服务器部署组合

本目录只保存服务器到固定角色的映射，不复制源码、数据库、素材、密钥或备份。所有组合使用同一个经过验证的应用镜像版本。

角色的打包路径清单在 `../role-definitions/role-01.yaml` 至 `role-07.yaml`；六步发布总流程在 `../common/global-release-flow.yaml`。它们都是 `00-platform-source` 内的“配方”，外层 `01—07/releases/<version>` 才是自动生成、禁止手改并可上传服务器的成品。

固定角色：

1. `01-hq-source-control`：总部端、代理源、客户源。
2. `02-agency-runtime`：多代理、多级代理运行端。
3. `03-client-plan-runtime`：多客户端和客户端多个计划。
4. `04-content-worker`：素材、构建、发布和异步任务。
5. `05-edge-observability`：网关、HTTPS、域名和观测。
6. `06-data-services`：PostgreSQL、Redis和对象存储。
7. `07-backup-disaster-recovery`：异地备份和恢复演练。

扩容顺序：数据 → worker → 公网入口 → 总部控制 → 代理/客户运行 → 独立异地灾备。

`01` 至 `06` 组合都必须配置外部备份目标；只有 `07-server.yaml` 把专用灾备节点计入服务器数量。

## 只读发布计划生成器

`../scripts/generate-release-plan.py` 只读取角色定义和服务器组合，默认执行 dry-run 并把 JSON 计划输出到终端。它不会复制源码、创建外层发布目录、读取环境变量或密钥、上传文件，也不会连接服务器。

```powershell
& '<本机 Python 路径>' deployment/scripts/generate-release-plan.py 3 2026.08.18.1
```

两个位置参数分别是服务器数量 `1—7` 和版本号。JSON 会列出服务器与角色映射、依赖部署顺序、根据当前电脑动态解析的外层 `artifactRoot` 与版本目录、源码包含/排除清单、环境变量模板和健康检查。这里显示的目录只是计划目标，不会被创建。

运行全部 1—7 台组合的只读自检：

```powershell
& '<本机 Python 路径>' deployment/scripts/generate-release-plan.py --self-check
```

运行基础测试：

```powershell
& '<本机 Python 路径>' -m unittest deployment/scripts/test_generate_release_plan.py
```

计划生成后仍需经过 `../common/global-release-flow.yaml` 的预检、影响审核和批准；本工具不是构建器或发布器。
