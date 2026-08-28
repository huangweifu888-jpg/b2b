# 企业知识图谱运行契约

## 1. 业务目标与客户买点

企业知识图谱不是重新建立一套企业、产品、证书或客户主数据，而是把分散在法务主体、产品护照、质量证书、ICP和授权素材中的已批准事实，连接为可被GEO、结构化数据、AI检索、商业平台和销售工具稳定消费的关系网络。客户购买它的价值是：所有对外答案都能追溯到具体来源、修订、状态和指纹；产品能力、合规证明、案例和目标市场不再各说各话；来源变化会自动阻断旧事实继续发布。

与普通图数据库或AI知识库不同，本平台要求六类实体完整、每个实体固定权威来源、每条关系提供证据并异人验证、发布者与图谱作者分离、下游显式确认精确清单。它只发布不可变的事实投影，不抢占工程、证照、客户或内容主档权威，也不允许AI自动补造缺失事实。

## 2. 权威来源与数据边界

- 企业主体来自已启用法务主体。
- 产品和能力来自已发布产品护照；知识图谱不复制工程主档。
- 证书来自已验证且未过期的产品护照证书；不复制证照主档。
- 案例来自拥有有效版权范围的DAM素材。
- 市场来自已启用ICP不可变版本；不复制客户或联系人主档。
- 系统绝不删除或修改法务主体、产品护照、证书、ICP或DAM来源记录。

```text
engineering_master_copied = false
certificate_master_copied = false
customer_master_copied = false
source_revision_pinned = true
source_fingerprint_pinned = true
unverified_fact_publishable = false
relation_self_verification = false
graph_author_self_publish = false
consumer_system_mutated = false
publication_acknowledgement_required = true
published_versions_mutable = false
```

## 3. 状态机与职责分离

- 图谱：`draft → published`，作者不能发布自己的图谱。
- 实体：`pending → verified`，引入者不能验证自己的实体；验证时重查来源修订、状态与指纹。
- 关系：`pending → verified`，创建者不能自验；验证时重查关系两端的来源固定。
- 版本：发布时一次生成 `published` 不可变清单，覆盖 organization / product / capability / certificate / case / market 六类实体以及至少五条已验证关系。
- 下游发布：`pending → acknowledged`，发布者不能代替GEO、结构化数据、AI检索、商业平台或销售工具确认接收。

## 4. 数据对象、权限与指标

核心对象为 `FactoryKnowledgeGraph`、`FactoryKnowledgeEntity`、`FactoryKnowledgeRelation`、`FactoryKnowledgeGraphVersion`、`FactoryKnowledgePublication` 和 `FactoryKnowledgeEvidence`。全部记录携带 `project_id / agent_path / tenant_id / client_id / plan_id`。

```text
factory.recommend.knowledge.graph.manage
factory.recommend.knowledge.entity.verify
factory.recommend.knowledge.relation.manage
factory.recommend.knowledge.relation.verify
factory.recommend.knowledge.publish
factory.recommend.knowledge.handoff.acknowledge
```

经营指标包括已验证实体数、六类实体完整率、已验证关系数、关系验证率、已发布版本数、下游确认率、来源漂移阻断数和事实复用次数。

## 5. API、页面、迁移和验收

API前缀：`/api/v1/factory-platform/projects/{project_id}/knowledge-graph`。真实页面：`/zb/client-source/knowledge-graph`。页面覆盖图谱身份、六类权威实体引入、异人实体验证、五条核心关系、异人关系验证、不可变版本发布和下游确认。

Alembic修订 `f7d39a5b8ce6`，父修订 `e6c28f4a7bd5`。回滚只删除知识图谱投影、版本、发布、证据和六项权限，不修改任何来源主档或下游系统；生产回滚前导出已发布清单和确认记录。

验收至少证明：六类实体100%覆盖；五条关系全部独立验证；实体来源修订、状态、指纹均未漂移；作者、验证者、发布者和消费者职责分离；清单哈希可重算；下游精确确认；来源记录零修改；项目隔离；页面无横向溢出；迁移可升降级；后端测试、TypeScript、平台蓝图契约与生产构建全部通过。
