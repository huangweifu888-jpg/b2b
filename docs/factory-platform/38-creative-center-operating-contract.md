# AI 创意中心运营契约

## 1. 经营目的与客户买点

AI 创意中心把企业定向采购角色、区域权利合规素材和人工审核连接成可追溯创意生产线。客户购买的不是“无限生成文案”，而是每条创意都能回答服务哪个采购角色、引用哪个内容包、是否使用 AI、由谁人工审核、最终在哪个渠道确认的商业资产。

## 2. 权威来源与共享边界

- 企业定向提供已发布 ABM 版本和全部已批准采购角色剧本。
- DAM 与本地化中心提供已发布国家内容包、有效素材权利、术语和区域合规审核。
- AI 只能辅助生成候选内容，必须保存模型引用和提示词哈希，不得自动批准或发布。
- 广告、营销、销售和网站只接收不可变创意版本哈希并显式回执。

```text
source_records_copied = false
abm_version_pinned = true
country_pack_rights_revalidated = true
complete_role_coverage_required = true
ai_output_direct_publish = false
variant_self_approval = false
brief_author_self_publish = false
raw_customer_identifier_stored = false
published_versions_mutable = false
consumer_system_mutated = false
acknowledgement_required = true
```

## 3. 状态机与职责分离

- 创意简报：`draft → published`
- 创意候选：`review → approved`
- 渠道激活：`pending → acknowledged`

创意创建人不得自行批准，简报作者不得自行发布，发布人不得自行确认渠道回执。审核和发布前重新校验 ABM 版本、采购角色剧本、国家内容包、素材权利和内容哈希；任一来源漂移立即阻断。

## 4. 权限、租户与审计

- `factory.lead.creative.manage`
- `factory.lead.creative.variant.approve`
- `factory.lead.creative.publish`
- `factory.lead.creative.activation.acknowledge`

五张创意表均携带 `project_id`、`agent_path`、`tenant_id`、`client_id`、`plan_id`。所有写操作经过项目权限检查并记录 `factory.creative.*` 审计；跨项目读取必须为空。

## 5. 运营指标与验收

- 已发布创意计划数、已批准创意数
- 采购角色覆盖率、AI 创意人工复核率
- 不可变创意版本数
- 广告、营销、销售、网站四渠道回执率

完成条件：每个已批准 ABM 角色剧本恰好一个人工批准创意；角色覆盖率与 AI 人工复核率均为 100%；内容、提示词、来源和版本哈希可复算；四渠道全部回执；不保存客户原始标识、不复制或修改来源、不改写下游；证据、审计和权限齐全。

## 6. 迁移与回滚

迁移为 `8c2e5a0b7d49`，上游为 `7b1d4f9a6c38`。回滚前导出简报、内容哈希、提示词哈希、版本清单和渠道回执。回滚只删除创意投影、版本、激活、证据和新增权限，绝不删除或修改 ABM、DAM、素材权利、源文件或下游系统。

## 7. 开发与验收顺序

1. Alembic 升级、回滚、再升级。
2. 专属测试覆盖 AI 人工审核、角色完整性、权利漂移和租户隔离。
3. 全量工厂测试、布局、租户上下文、TypeScript、蓝图契约和15道门禁。
4. 三类身份执行真实 API 简报、角色创意、人工审核、发布与四渠道回执。
5. 数据库复核来源未改、无客户原始标识、哈希、证据、审计和权限。
6. 生产构建与真实页面核对指标、导航、面包屑和横向溢出。
