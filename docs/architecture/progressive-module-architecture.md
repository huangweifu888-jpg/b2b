# 渐进模块化开发与发布规则

## 结论

本项目采用“单一源码仓库 + 渐进模块化单体 + 三端组合清单 + 01–07 角色发布包”。当前阶段只建立机器可读契约、旧模块映射、组合清单和一个试点清单，不移动现有前后端实现。

三个边界必须分开：

- `modules` 是开发归属、契约和测试边界。
- `zbcx`、`dlcx`、`khcs` 是端侧组合、权限和使用模式边界。
- 外层 `01`–`07` 是构建后生成的服务器角色包边界。

文件夹独立不等于进程、数据库、代码仓库或服务器独立。只有负载、合规、故障隔离或独立发布周期形成明确证据后，才继续拆成独立服务。

## 唯一事实源

`frontend/src/lib/factory-platform-blueprint.ts` 继续作为 12 类、72 应用的产品事实源，负责产品名称、应用 ID、路由、状态和产品元数据。第一阶段不得从技术目录反向覆盖它。

技术目录只负责稳定 ID 到可移植目录名的映射：

- 主架构契约：`modules/module-architecture.json`
- 12 类技术目录：`modules/technical-category-catalog.json`
- 新模块根目录：`modules/categories`

目录使用 `cNN_snake_case`，例如 `c05_deepen`。应用目录使用 `snake_case`，例如 `social_matrix`，以兼容 Python、TypeScript 和通用构建工具。

## 当前渐进状态

现有 `modules/00-product-market` 到 `modules/10-health-dashboard` 是旧 11 模块兼容层，暂时保留，不改名、不删除。旧模块到新分类或应用的完整映射记录在 `module-architecture.json` 的 `legacyMappings`。

当前只建立一个真实试点目录：

```text
modules/categories/
└─ c05_deepen/
   ├─ category.manifest.json
   └─ apps/
      └─ social_matrix/
         └─ app.manifest.json
```

该试点对应：

- 产品应用 ID：`deepen.social-matrix`
- 旧模块：`05-social-media`
- 旧页面：`frontend/src/pages/SocialMedia.tsx`
- 兼容路由：`/social?tab=accounts`
- 当前状态：`manifest-only`
- 实现是否移动：`false`

其余 11 类现在只存在于 JSON 技术目录中，不创建空文件夹。以后只有在项目具备负责人、稳定契约、独立权限、数据归属、测试和迁移任务时，才创建对应物理目录。

## 三端组合规则

组合文件只引用稳定分类 ID 和使用模式，不复制任何业务实现：

| 组合 | 文件 | 模式 | 职责 |
|---|---|---|---|
| 总部端 | `zbcx/compositions/hq.json` | `govern` | 基线、审批、发布环和路由政策 |
| 代理源 | `zbcx/compositions/agency-source.json` | `publish` | 在总部允许范围内发布代理配置 |
| 客户源 | `zbcx/compositions/client-source.json` | `configure` | 管理可发布的客户源配置和模板版本 |
| 代理端 | `dlcx/composition.json` | `operate` | 按后代代理范围和授权运行 |
| 客户端/计划 | `khcs/composition.json` | `use` | 按租户、客户、可选计划和权益使用 |

组合清单列出 12 个稳定分类 ID；具体 72 应用仍从产品事实源解析，再经过已发布版本、权限和套餐权益过滤。因此，组合清单不是一份源码副本，也不是承诺所有应用对所有租户同时开放。

## 试点迁移流程

一个应用必须按以下顺序迁移：

1. 在产品事实源确认稳定应用 ID、分类和兼容路由。
2. 建立应用 manifest，声明三端模式、租户上下文、旧模块和迁移状态。
3. 固定共享契约以及 API、事件、权限、数据归属和回滚规则。
4. 添加契约测试和旧路径兼容适配器。
5. 一次迁移完整垂直切片，包括前端入口、后端服务、数据迁移、测试和说明；不得只搬一半。
6. 验证旧路由、三端组合、权限、租户隔离和 01–07 角色打包。
7. 验收后更新 manifest 的迁移状态，再开始下一个应用。

在当前 `phase-1-contract-foundation` 阶段，`implementationMovesAllowed` 为 `false`。只有下一阶段的契约测试与兼容适配门通过后，才允许迁移试点实现。

## 数据与依赖原则

- 代理、客户和计划是数据、配置、模板及覆盖层，不是源码分支。
- 租户相关操作必须验证 `agent_path`、`tenant_id`、`client_id` 和可选 `plan_id`。
- 模块只能通过共享契约、API 或事件协作，不得导入其他模块的实现。
- 第一阶段继续使用现有数据库体系；按模块明确数据表与迁移归属，不建立 72 个数据库。
- 公共计划下载仍只归旧兼容模块 `02-content` 所有，并且只通过 HTTPS 暴露。

## 服务器发布规则

服务器不直接接收 `00-platform-source`，也不手工上传某个 `modules` 文件夹。正确流程是：

1. 在 `00-platform-source` 开发、检查源码锁并完成测试。
2. 按端侧组合、权限和 deployment 角色规则解析所需模块。
3. 编译前端、准备后端运行代码和迁移计划。
4. 生成不可变的 01–07 角色发布包、manifest 和哈希。
5. 只把对应角色成品上传到对应服务器。
6. 执行迁移、健康检查、分环发布和必要回滚。

1–7 台服务器是同一组角色的不同组合，不是 12 类或 72 应用的服务器归属。模块目录规划不能改变现有 deployment 角色规则；只有试点完整验证后，才逐步收紧各角色的包含清单。

## 验证

结构变更后执行：

```powershell
python tools/verify_platform_layout.py
python -m unittest tools.tests.test_verify_platform_layout
```

验证器同时检查：旧 11 模块兼容顺序、12 类技术目录、唯一试点、五份组合清单、01–07 边界以及 `02-content` 下载归属。
