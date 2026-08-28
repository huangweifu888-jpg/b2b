# 02.布场｜产品内容中心运营契约

## 客户价值与闭环

产品内容中心把工厂已经获批的产品事实，转化为可审计的网站、渠道、销售与 SEO 内容版本。闭环为：`产品事实引用 → 内容资产 → 不可变内容版本 → 独立复核 → 受控交接 → 独立批准 → 下游回执`。

客户购买的不是另一套产品主数据，而是避免官网、渠道和销售资料各自改写规格的内容治理：每一版本都固定产品事实引用和哈希，能说明由谁编写、谁复核、交给哪个消费者，以及出现问题时恢复到哪个交接点。

## 事实边界与三端共享契约

`content.product` 只保存渠道内容及其 `product_fact_reference`，不复制或修改 PLM/ERP 中的产品主档、BOM、库存、标准成本、工程参数或外部凭据。每条记录绑定 `agent_path`、`tenant_id`、`client_id`、`plan_id` 和 `project_id`，不同项目不可互读。

总部端只提供规则和可复用标准；代理源端、客户源端只沿批准分支交接；运行端显式确认收到版本。受控面板读取原有产品编辑器的已发布内容并固化副本，不覆盖编辑器草稿、客户本地内容、网站、页面锁定或渠道实例。

## 生命周期与权限

- 资产：`active`；产品引用在项目内唯一。
- 内容版本：`draft → reviewed`；作者不能复核自己的版本，内容或事实引用哈希漂移即阻断。
- 交接：`pending-approval → approved → available`；准备人不能批准，批准人不能代替下游确认。
- 权限：`factory.content.product.asset.manage`、`factory.content.product.version.review`、`factory.content.product.publication.approve`、`factory.content.product.handoff.acknowledge`。
- 对象契约：冻结 `product-content-version`；事件契约：冻结 `product-content-released`。

## 验收与回滚

迁移 `4d9e2b7c1f83` 创建四张租户投影、权限和两个冻结契约。回滚只移除这些治理投影、权限与契约，绝不删除产品主档、工程事实、本地草稿或已交付的下游内容。

达到 `available` 前，必须完成迁移升级/回滚/再升级、自动化测试、总部/代理/客户三身份 API、共享客户源页面、TypeScript、开发规范门禁、生产构建和真实页面验收。三身份 API 验收命令为 `tools/run_product_content_api_acceptance.ps1`。

2026-08-06：迁移 `4d9e2b7c1f83` 已完成升级、回滚与再次升级演练；总部、代理、客户三身份 API 得到 `available` 消费者回执，且产品主档、工程事实、BOM/库存/成本均未被写入。`/products?tab=list` 共享客户源页面验收得到 `live`、四条治理记录、六个生命周期动作且 1280 宽度无横向溢出。因此 `content.product` 已明确提升为 `available`。
