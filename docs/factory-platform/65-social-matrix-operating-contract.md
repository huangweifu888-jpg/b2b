# 国内外社媒矩阵运营契约

应用 ID：`deepen.social-matrix`；客户路由：`/social?tab=accounts`；成熟度：`available`。

这里的 `available` 只表示内部账号矩阵、审核、留痕和发布版本治理已具备，不表示所有第三方平台已经完成 OAuth、实时同步、外部发布或互动订阅。没有客户应用审核、凭据引用、官方权限和沙盒回执时，外部动作必须保持安全阻断。

## 客户购买的能力

系统把客户真实社媒主页、总部受控的凭据引用和官方或人工核验的指标快照，组合为一个可追溯的国内外账号矩阵。它不保管密码或令牌，也不以“已连接”伪装未经验证的 OAuth；而是让总部、服务商、客户明确完成来源绑定、独立核验、发布与签收。这样工厂能安全地管理多市场账号资产、对齐品牌与运营责任，并为内容日历、聆听、社群和归因提供同一可信账号底座。

## 六个一级应用与九个二级工作区

`factory-platform-social-workspace-v1` 是九项客户业务页面的唯一导航契约。六个一级应用继续拥有业务对象和 API，九项横栏作为真实二级页面投影到栏目配置、运营市场、左侧栏、08 页面锁定器、07 页面工厂和规范生成器；`customer-roadmap` 只供开发器使用，不得进入客户业务导航。

| 一级应用 | 二级工作区 | 真实路由 | 当前可执行边界 |
| --- | --- | --- | --- |
| 社媒矩阵 | 营销作战、运营总览、账号连接、平台设置 | `marketing-playbook`、`dashboard`、`accounts`、`settings` | 策略、画像、主页资产、人工核验、矩阵治理与设置可执行；外部连接仍受官方授权门禁 |
| 内容日历 | 发布中心 | `schedule` | 审核、排期与发布队列可执行；没有核验授权时外部发布必须阻断 |
| 本地分发 | 内容创作 | `create` | 草稿、多语本地化、素材权利与人工审核可执行；AI 草稿不能直接外发 |
| 社交聆听 | 数据归因 | `analytics` | 公开证据评估、官方／人工快照和内容线索归因可执行；不冒充实时监听 |
| 私域社群 | 互动转化 | `automation` | 线索资格、人工回复审核和 CRM 交接记录可执行；不做未授权自动回复 |
| 直播倡导 | 视频创作 | `digital-human` | 视频任务、素材权利和倡导治理可执行；生成、渲染、上传与直播仍需连接器 |

国内外渠道统一读取 `social-channel-contract-v1`：当前登记 16 个规范化渠道（国内 8、海外 8），Facebook/Instagram 仅具备 Meta 准备检查，其余标记为“待接连接器”。来源运营包的允许渠道会约束账号连接清单；别名会归一化，但不会由前端保存令牌或绕过平台审核。

## 对象、三端职责和边界

冻结对象为 `social-account-matrix`，最小字段为 `tenantId`、`matrixId`、`pageAssetId`、`credentialReferenceId`、`snapshotFingerprint`；冻结事件为 `social-matrix-published`。平台蓝图、栏目配置、运营市场、左侧导航和页面锁定器只能共享 `deepen.social-matrix` 与 `/social?tab=accounts` 的同一投影。

| 动作 | 权限 | 强制约束 | 审计 |
| --- | --- | --- | --- |
| 创建矩阵 | `factory.deepen.social-matrix.create` | 项目内唯一矩阵键与市场范围 | `factory_social_matrix_created` |
| 绑定账号 | `...bind` | 同项目主页、同渠道活跃凭据引用、至少一条官方或人工核验快照；仅固定指纹 | `factory_social_matrix_page_bound` |
| 独立核验 | `...verify` | 核验者不得为创建者 | `factory_social_matrix_verified` |
| 独立发布 | `...publish` | 发布者不得为创建者或核验者；生成不可变版本 | `factory_social_matrix_published` |
| 独立签收 | `...acknowledge` | 签收者不得为发布者 | `factory_social_matrix_acknowledged` |

总部登记不含秘密内容的凭据引用；服务商独立核验；客户发布本项目矩阵；总部或另一授权方签收。矩阵不会修改 OAuth 应用、凭据引用、主页资产、指标快照、内容审核、发布任务、CRM 或第三方社媒系统。

## 迁移、回滚与验收

迁移 `e7a4c9d2b605` 创建矩阵、绑定、发布版本、项目/租户索引、权限和冻结对象/事件契约。回滚仅删除这些投影、权限和契约，绝不删除 OAuth、凭据引用、主页、指标、内容、发布任务或密钥库内容。

`tools/run_social_matrix_api_acceptance.ps1` 以总部、服务商、客户本地真实会话创建总部应用安全引用、客户授权请求、总部凭据引用、客户主页与人工核验快照，再完成矩阵创建、绑定、独立核验、独立发布和签收；它不会提交令牌、授权码或外部发布。`tools/inspect_social_matrix_acceptance.py` 从数据库独立核对三类来源指纹、异人职责、签收和五类审计。页面验收要求账号页使用真实 API 展示创建、绑定、核验、发布和签收控件，1280px 无横向溢出；自动化测试、TypeScript、共享契约门禁与生产构建必须全部通过。
