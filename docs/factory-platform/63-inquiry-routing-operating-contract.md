# 全渠道询盘与线索分配运营契约

应用 ID：`convert.inquiry`、`convert.routing`；客户路由：`/inquiries`、`/inquiries?tab=rules`；当前成熟度：`available`。

## 可售能力与客户价值

这不是另一张线索表。系统将网站、邮件、社媒、平台、商城和人工录入的询盘在项目与租户范围内以来源指纹去重；仅保留必要业务摘要，不保存原始载荷。每条询盘必须经独立身份审核，才可匹配一条已独立审批并启用的路由规则。负责人必须确认接收，才可固定该询盘修订并创建收入黄金链路中的 `inquiry-created` 记录。

客户购买的是可追责的“从来源到收入”闭环：减少重复跟进和漏跟进，明确审核、分配、接收与销售交接责任；并能把询盘质量、首次响应和 MQL 转 SQL 作为可追溯指标，而不是用静态表格或人工口头承诺替代。

## 对象、权限与三端共享契约

核心对象为 `factory-inquiry`，核心事件为 `inquiry-routed`；均为 `frozen` 契约。对象最小字段为 `tenantId`、`inquiryId`、`sourceChannel`、`sourceReferenceHash`、`accountReference`、`productReference`。三端页面、平台蓝图、栏目配置、运营市场、左侧导航与页面锁定器只消费同一应用 ID、路由和 `deliveryStatus` 投影，禁止各端维护第二份目录或绕过后端权限。

| 动作 | 权限 | 强制边界 | 审计动作 |
| --- | --- | --- | --- |
| 登记询盘 | `factory.convert.inquiry.create` | 支持渠道、来源指纹唯一、只存摘要 | `factory_inquiry_created` |
| 独立审核 | `factory.convert.inquiry.qualify` | 审核人不能是创建人，修订必须未变化 | `factory_inquiry_qualified` |
| 创建/审批/启用规则 | `factory.convert.routing.create`、`approve`、`activate` | 作者、审批人、启用人相互独立 | `factory_inquiry_routing_rule_*` |
| 执行分配/接收 | `factory.convert.routing.route`、`acknowledge` | 只匹配启用规则；接收人不能是路由人 | `factory_inquiry_routed`、`factory_inquiry_assignment_acknowledged` |
| 交接收入链路 | `factory.convert.inquiry.handoff` | 必须已有接收回执，并固定询盘修订 | `factory_inquiry_revenue_handed_off` |

总部维护权限、审计与异常处置；服务商可独立审核和审批规则；客户可启用规则、确认接收和交接收入。生产环境以实际登录身份执行；本地开发页的三端切换仅用于演示相同的后端权限与异人约束。

## 生命周期、迁移与回滚

询盘：`received → qualified → routed → handed-off`。规则：`draft → approved → active`。分配回执：`pending → acknowledged`。任何过期修订、自审、无匹配启用规则、无回执交接或跨项目访问均被 API 拒绝。

迁移 `c4e8a1d6f902` 创建询盘投影、规则、分配回执、证据、租户/项目索引、权限和冻结对象事件契约。回滚仅移除这些投影、权限和契约；绝不删除来源渠道消息、客户账户、收入流、报价、订单或付款记录。回滚前必须导出询盘、规则、回执和审计证据，并停止新分配。

## 正式可用证据

`tools/run_inquiry_routing_api_acceptance.ps1` 以总部、服务商、客户三种真实本地会话依次创建询盘、独立审核、创建/审批/启用规则、分配、接收回执和收入交接；它没有种子或后门。`tools/inspect_inquiry_routing_acceptance.py` 重新读取数据库，核验来源哈希、不存原始来源编号、异人职责、冻结契约、八类审计、证据、租户权限与 `inquiry-created` 收入阶段。

页面验收要求 `/inquiries` 加载 live 工作台、真实 API 客户端、采集/规则/审核/启用/分配/回执/交接控件以及 1280px 无横向溢出。以上证据、自动化测试、TypeScript、共享契约门禁和生产构建均通过后，`convert.inquiry` 与 `convert.routing` 才可显示为 `available`；不承诺自动回复、自动定价、自动改写 CRM 或外部渠道写入。
