# CDP 客户数据产品运营契约

程序 ID：`portrait.cdp`；客户路由：`/customer-data-platform`；当前成熟度：`pilot`。

## 唯一事实源与边界

CDP 不拥有客户身份、同意、客户旅程、营销触点、询盘、订单或服务工单的主记录。它只引用已发布的 `golden-profile-version`、`customer-timeline-version` 与 `audience-segment-version`，形成不可变的 `cdp-data-product` 指针清单。原始联系人、邮箱、设备、Cookie、OAuth 密钥和下游业务记录均不得写入 CDP。

三个来源版本必须属于同一项目；身份档案和客户旅程还必须属于同一账户。创建、审批、发布前都会计算并校验来源清单哈希。任何来源撤回、状态变化、哈希漂移或账户不一致都会阻止发布。

## 生命周期与权限

`draft → approved → available` 是数据产品状态；每个消费者交接为 `pending → acknowledged`。审批人不能是创建人，发布人不能是审批人，回执人不能是发布人。

| 动作 | 权限 | 审计动作 |
| --- | --- | --- |
| 建立产品 | `factory.portrait.cdp.create` | `cdp-product-created` |
| 独立审批 | `factory.portrait.cdp.approve` | `cdp-product-approved` |
| 发布指针清单 | `factory.portrait.cdp.publish` | `cdp-product-released` |
| 登记消费者回执 | `factory.portrait.cdp.acknowledge` | `cdp-consumer-acknowledged` |

消费者仅限 CRM、营销、销售、服务；交接只传递冻结清单哈希，`consumer_mutated=false`，不触发任何下游写入。

## 对象与事件契约

对象 `cdp-data-product` 的最小字段为 `tenantId`、`profileVersionId`、`timelineVersionId`、`segmentVersionId`、`manifestHash`。事件 `cdp-data-product-released` 必须含 `eventId`、`tenantId`、`subjectId`、`version`，兼容策略为 backward，生命周期为 frozen。

## 迁移、回滚与三端

迁移 `f3d7a9c2b506` 新建 CDP 投影、发布回执、证据及权限，并登记上述对象事件；降级只删除这些投影、权限和契约，绝不删除身份、同意、分群、旅程或下游系统数据。回滚前导出产品清单、回执和审计证据。

总部负责权限、审计与异常处理；服务商负责来源可用性和运营协同；客户负责审批、发布和消费者回执。三端页面都从平台蓝图的同一应用 ID、路由和交付状态投影，不能维护第二份目录或将 `pilot` 宣传为 `available`。

## 销售承诺边界

试点只承诺受控的数据产品组合、来源漂移拦截和回执证据；不承诺跨系统实时同步、自动改写 CRM/广告平台，或在没有同账户已发布来源时创建客户数据产品。正式可用必须另行通过三角色 API 验收、迁移回滚演练、真实页面验收、共享契约门禁和正式版本发布。

## 正式可用证据

`portrait.cdp` 自 2026-08-07 起为 `available`。验收不设置种子后门：`tools/run_cdp_api_acceptance.ps1` 通过总部、代理、客户三种真实会话，建立同一账户的营销触点、询盘、报价、经过 QMS 放行的履约订单及服务工单，再分别发布身份、旅程和账户同意分群，最终生成冻结 CDP 指针产品并取得 CRM、营销、销售、服务四个独立回执。`tools/inspect_cdp_acceptance.py` 对数据库重新核验来源哈希、同账户分群成员、异人审批/发布/回执、审计、权限与不改写来源边界；页面验收须验证 `/customer-data-platform` 的 live 状态、来源组合选择器、四个生命周期动作及 1280px 无横向溢出。
