# DAM素材与本地化运行契约

## 1. 业务目标与客户买点

DAM素材与本地化不是一个网盘，也不是把机器翻译按钮放进CMS。它把工厂已有的产品图、视频、文档和销售素材，变成“来源可证明、使用有授权、术语不漂移、区域质量有人负责、下游精确确认”的国家内容包。客户购买它的直接价值是：同一份产品事实可以安全复用到不同国家和渠道，减少侵权、错译、品牌走样和未经区域评估直接上线的风险，同时缩短重复找素材、重复翻译、重复复核的周期。

平台的差异化在于把内容生产与经营责任连成闭环：私有文件存储保留原文件权威，DAM只引用元数据和SHA-256；版权范围先于本地化；术语版本不可变；翻译提交与质量复核职责分离；税务、隐私和市场准入评估齐备后才允许形成国家内容包；CMS、社交、商业和GEO系统必须显式确认接收，DAM不越权回写消费者系统。

## 2. 权威来源与系统边界

- 私有文件存储是原始字节和恶意文件扫描的唯一权威来源，DAM不复制原始字节。
- 产品工程主数据仍归履约/产品域所有，DAM只保存产品引用，不复制产品主档。
- 区域法律、税务、隐私和市场准入评估仍由对应责任域出具，DAM只固定其评估引用。
- DAM绝不删除或修改私有原文件，也不直接修改CMS、社交、商业或GEO记录。
- 每个本地化任务固定源文件SHA-256、版权授权、术语版本和术语哈希；任一固定事实漂移即阻断复核与发布。

关键契约：

```text
original_bytes_stored_in_dam = false
private_storage_is_authority = true
source_sha256_pinned = true
rights_required_before_localization = true
glossary_versions_mutable = false
machine_translation_direct_publish = false
translator_self_review = false
regional_legal_assessment_replaced = false
consumer_system_mutated = false
handoff_acknowledgement_required = true
product_master_copied = false
```

## 3. 状态机与职责分离

- 素材：`draft → active`。只有独立批准版权范围后才激活。
- 版权授权：`pending → active`。申请人与批准人不得相同，授权固定国家、语言、渠道、有效期和证据。
- 术语库：`draft → active`。作者不得批准自己的术语版本；已创建版本不可修改。
- 本地化任务与译件：`draft → review → approved / rejected`。机器翻译只能作为辅助，译者不得复核自己的译件；批准要求语言、术语、品牌、文化四项评分均不低于80。
- 国家内容包：`draft → published`。创建人与发布人不得相同，发布前必须验证全部译件、源SHA、术语哈希和区域评估。
- 下游交接：`pending → acknowledged`。发布者不能代替下游消费者确认。

## 4. 核心数据对象

- `FactoryDamAsset`：私有洁净素材的元数据引用和源文件指纹。
- `FactoryDamRightsGrant`：国家、语言、渠道、有效期和授权证据。
- `FactoryLocalizationGlossary` / `FactoryLocalizationGlossaryVersion`：稳定术语身份及不可变版本。
- `FactoryLocalizationJob`：固定素材、授权、术语、市场、语言和渠道的本地化任务。
- `FactoryLocalizedRendition` / `FactoryLocalizationReview`：译件指纹与异人四维质量复核。
- `FactoryCountryContentPack`：通过区域评估的不可变国家内容清单。
- `FactoryLocalizationHandoff`：面向下游消费者的精确版本交接与确认。
- `FactoryDamEvidence`：追加式业务证据链。

所有对象均携带 `project_id / agent_path / tenant_id / client_id / plan_id`，读写受项目访问和细粒度权限约束。

## 5. 权限

```text
factory.content.dam.asset.manage
factory.content.dam.rights.approve
factory.content.dam.glossary.manage
factory.content.dam.glossary.approve
factory.content.dam.localization.manage
factory.content.dam.localization.review
factory.content.dam.pack.publish
factory.content.dam.handoff.acknowledge
```

## 6. 经营指标

- 有效素材数和版权覆盖率。
- 已批准译件数与本地化质量通过率。
- 已发布国家内容包数。
- 下游交接确认率。
- 因源文件、授权或术语漂移而被阻断的任务数。
- 按国家、语言、渠道统计的素材复用率、本地化周期和返工率。

## 7. API与真实页面

API前缀：`/api/v1/factory-platform/projects/{project_id}/dam-localization`。真实页面：`/zb/client-source/dam-localization`。页面覆盖洁净素材引用、版权申请和异人批准、不可变术语建立和异人启用、本地化任务、译件提交、四维质量复核、国家内容包、独立发布及下游确认。

## 8. 迁移、回滚与验收

Alembic修订 `e6c28f4a7bd5`，父修订 `d5b17e3f6ac4`。回滚只删除DAM与本地化拥有的十张表和八项权限，不删除或修改私有原文件、产品主档、区域评估或消费者系统记录。生产回滚前导出已发布国家包清单、术语版本、版权授权和已确认交接证据。

验收至少证明：三身份职责分离；版权先于本地化；术语版本不可变；源SHA固定；译者不能自审；机器翻译不能直接发布；四维质量分均不低于80；国家包清单哈希可重算；税务、隐私、准入评估完整；下游精确确认；源文件记录零修改；其他项目不可见；页面无横向溢出；迁移可升降级；后端测试、TypeScript、平台蓝图契约和生产构建全部通过。

2026-08-06 可用性结论：本应用已从试点升级为 `available`。本地三角色 API 验收完整跑通资产引用、版权范围、不可变术语、翻译提交、异人四维复核、国家内容包、独立发布和 CMS 确认；最新证据链可由 `tools/inspect_dam_localization_acceptance.py` 从数据库重算。真实客户源页面以 `data-factory-dam-page` 和 `data-dam-mode="live"` 加载，显示已确认内容包与治理边界，且无横向溢出。验收夹具只在私有存储创建唯一 CSV 文件后才注册其元数据，不复制或改写任何已存在的源文件。
