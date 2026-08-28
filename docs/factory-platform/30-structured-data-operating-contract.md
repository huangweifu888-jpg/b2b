# 结构化数据中心运营契约

## 1. 经营目的与客户买点

结构化数据中心把企业知识图谱中的已验证事实转成搜索引擎、商城和 AI 推荐系统能够稳定读取的 JSON-LD。工厂不再由不同网站、运营人员和渠道分别手填产品、企业、问答、案例与市场事实，而是复用同一套可追溯来源、同一版本和同一发布哈希。

客户购买的不是“再装一个 SEO 插件”，而是从权威业务事实到机器可读发布的治理链路：事实有来源、映射有人复核、错误不能发布、上线内容可按哈希验收、渠道必须确认接收。这样可降低多语言、多国家、多站点扩张时的事实冲突与返工成本。

## 2. 上下游边界

- 上游唯一输入是状态为 `published` 的企业知识图谱版本。
- 固定 `graph_version_id`、版本号与 `manifest_hash`，不复制或改写知识图谱主数据。
- 每条 Schema 映射固定已验证实体的修订号与来源指纹。
- 下游网站、搜索、商城或 GEO 仅接收不可变 JSON-LD 发布物；本应用不直接改写下游系统。
- 下游必须对精确的 `document_hash` 回执确认。

共享契约：

```text
knowledge_graph_master_copied = false
graph_version_pinned = true
entity_source_fingerprint_pinned = true
mapping_self_verification = false
invalid_document_publishable = false
bundle_author_self_publish = false
published_release_mutable = false
consumer_system_mutated = false
publication_acknowledgement_required = true
```

## 3. 业务状态机

- 数据包：`draft → published`
- 映射：`pending → verified`
- 验证：`passed / failed`（验证结果不可修改，只能重新运行形成新记录）
- 发布物：直接生成不可变 `published` 版本
- 渠道交付：`pending → acknowledged`

禁止绕过顺序：数据包必须固定已发布图谱版本；五类映射必须全部异人验证；验证必须零错误；作者不能自发布；发布者不能自确认渠道回执。

## 4. 五类默认映射

| Schema.org 类型 | 权威图谱实体 | 默认必要字段 | 经营用途 |
|---|---|---|---|
| Organization | organization | name | 企业身份与品牌实体识别 |
| Product | product | name | 产品搜索、商城与 AI 产品识别 |
| FAQPage | capability | mainEntity | 能力问题与买家答案 |
| Review | case | itemReviewed | 经授权案例与信任信号 |
| Article | market | headline | 市场主题与内容归属 |

映射可以扩展字段，但必要字段缺失时验证必须失败。任何已固定实体修订或来源指纹发生变化，都必须重新建立映射，不允许静默沿用。

## 5. 权限与职责分离

- `factory.recommend.structured.bundle.manage`：建立数据包与映射。
- `factory.recommend.structured.mapping.verify`：独立验证映射和来源固定。
- `factory.recommend.structured.validation.execute`：生成并验证 JSON-LD。
- `factory.recommend.structured.publish`：独立发布不可变版本。
- `factory.recommend.structured.handoff.acknowledge`：渠道对精确哈希回执。

路由层对每次写操作执行项目权限检查并写入审计日志；业务表同时保存 `project_id`、`agent_path`、`tenant_id`、`client_id`、`plan_id`，禁止跨项目读取或操作。

## 6. 指标与运营验收

- 已验证映射数
- 五类 Schema 覆盖率
- 通过验证次数与验证通过率
- 已发布不可变版本数
- 渠道确认率

运营完成条件：五类覆盖率 100%、最新验证零错误且为 `passed`、发布物哈希可重算一致、渠道状态为 `acknowledged`、审计与业务证据均存在、来源知识图谱记录未被修改。

## 7. 数据库迁移与回滚

迁移：`0a4c7e2d9f61`，上游版本：`f7d39a5b8ce6`。

回滚前导出已发布 JSON-LD、文档哈希、验证报告与渠道确认记录。回滚只删除结构化数据映射、验证快照、发布物、交付记录、证据和新增权限；绝不删除或修改知识图谱、产品主数据、内容主数据、网站或搜索消费者。

## 8. 开发与验收顺序

1. 运行 Alembic upgrade / downgrade / upgrade 验证。
2. 运行结构化数据服务测试，确认异人验证、五类覆盖、来源漂移拦截和租户隔离。
3. 运行完整工厂平台测试、布局与租户上下文检查。
4. 运行 TypeScript 检查、平台蓝图校验与生产构建。
5. 用总部、审核、渠道三种身份完成真实 API 链路。
6. 重算 JSON-LD 哈希、核对审计、证据和上游记录未变化。
7. 在真实页面核对 5/100%/1/100%/1/100%、左侧导航、面包屑与横向溢出。
