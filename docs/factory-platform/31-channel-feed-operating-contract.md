# 商品Feed与平台刊登运营契约

## 1. 经营目的与客户买点

商品Feed与平台刊登把同一份已发布商品事实安全投影到 Google Merchant、Amazon、阿里国际站和行业平台。工厂无需在每个平台重复维护产品名称、SKU与基础属性，也不会因为运营人员手填价格库存而制造错误承诺。

客户购买的是“可治理的跨渠道商品发布链路”：产品来源可追溯、渠道密钥不进入业务库、价格库存必须有权威连接器引用、刊登必须异人验证、Feed错误为零才能发布、每个平台对精确哈希回执。它与普通批量刊登工具的差异，是对事实归属、商业承诺和发布责任有可审计边界。

## 2. 上下游边界

- 上游唯一商品内容来源是状态为 `published` 且哈希可重算的结构化数据发布物。
- 目录固定结构化发布物ID、版本号和 `document_hash`；刊登固定 Product 节点哈希。
- 渠道凭证仅保存密钥库引用，绝不保存 OAuth token、密码或API密钥明文。
- 默认 `catalog-only / on-request`，不发布价格与库存承诺。
- 只有同时提供权威价格引用和库存引用时，才允许 `connector-reference` 模式。
- 下游渠道只接收不可变Feed发布物；本应用不直接改写渠道系统，必须等待渠道回执。

共享契约：

```text
credential_secret_stored = false
product_master_copied = false
structured_release_pinned = true
price_inventory_source_reference_required = true
catalog_only_default = true
listing_self_validation = false
failed_feed_publishable = false
catalog_author_self_publish = false
published_release_mutable = false
consumer_system_mutated = false
publication_acknowledgement_required = true
```

## 3. 状态机

- 渠道账户：`pending → approved`
- 商品目录：`draft → published`
- 渠道刊登：`pending → validated`
- Feed校验：`passed / failed`，结果不可修改
- Feed版本：生成后为不可变 `published`
- 渠道交付：`pending → acknowledged`

禁止绕过：申请人不能自批渠道；刊登创建者不能自验证；目录作者不能自发布；失败Feed不能发布；发布者不能自确认渠道回执。

## 4. 四类渠道与商业事实模式

| 渠道 | 默认用途 | 凭证边界 |
|---|---|---|
| google-merchant | 搜索购物与商品结果 | 仅密钥库引用 |
| amazon | 跨境商城商品目录 | 仅密钥库引用 |
| alibaba | B2B国际站商品目录 | 仅密钥库引用 |
| industry-marketplace | 行业平台与区域平台 | 仅密钥库引用 |

`catalog-only` 只发布商品身份与属性，价格库存保持询价；`connector-reference` 必须带正价格、币种、价格来源引用、库存来源引用和受支持的可售状态。业务库不成为价格或库存主数据源。

## 5. 权限与审计

- `factory.recommend.channel.account.manage`
- `factory.recommend.channel.account.approve`
- `factory.recommend.channel.catalog.manage`
- `factory.recommend.channel.listing.validate`
- `factory.recommend.channel.feed.execute`
- `factory.recommend.channel.publish`
- `factory.recommend.channel.handoff.acknowledge`

每个写操作在路由层执行项目权限检查并写审计；业务表携带 `project_id`、`agent_path`、`tenant_id`、`client_id`、`plan_id`，禁止跨项目访问。

## 6. 运营指标与验收

- 已批准渠道数与四类渠道覆盖率
- 已验证刊登数与刊登验证率
- 通过Feed次数与错误数
- 已发布版本数、渠道回执率

完成条件：四类渠道覆盖100%、全部刊登独立验证、最新Feed错误为零、发布物哈希可重算一致、所有渠道已确认、上游结构化发布物未变化、密钥明文未入库、审计与业务证据齐全。

## 7. 迁移与回滚

迁移：`1b5d8f3a0c72`，上游：`0a4c7e2d9f61`。

回滚前导出Feed发布物哈希、渠道账户引用和渠道回执。回滚只删除渠道账户引用、目录投影、刊登验证、Feed发布物、交付记录、证据和新增权限；绝不删除或修改结构化数据发布物、产品主数据、价格库存主数据、密钥库记录或远端渠道记录。

## 8. 开发与验收顺序

1. Alembic upgrade / downgrade / upgrade。
2. 专属服务测试：职责分离、虚假价格库存拦截、来源漂移和租户隔离。
3. 完整工厂测试、平台布局与租户上下文检查。
4. TypeScript、平台蓝图、15道开发门禁与生产构建。
5. 总部、审核、渠道三身份完成真实API闭环。
6. 重算Feed哈希，核对上游记录未变化、密钥未入库、审计和证据齐全。
7. 真实页面核对4/100%/4/100%/1/100%、导航、面包屑与横向溢出。
