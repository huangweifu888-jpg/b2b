# 开发执行台与五条黄金业务链

开发执行台把蓝图、应用契约和七道门禁变成可追踪的工作队列。程序事实源为 `FACTORY_PLATFORM_EXECUTION_WORKSTREAMS`，首批队列只允许一个工作流保持“进行中”，其余工作按依赖排队。

## 执行台字段

每个工作流显示：稳定ID、顺序、短名称、执行状态、当前门禁、负责人角色、应交付产物、阻断条件、证据、下一动作和修订号。当前实现使用 `factory_execution_workstreams` 持久化，由总部管理员通过 `/api/v1/factory-platform/execution/workstreams` 读取和更新；每次更新写入审计日志，并以 `expected_revision` 防止并发覆盖。

控制面强制最多一条工作流为 `active`；标记 `done` 前必须提交证据。迁移 `f9a1c3d5e702` 只创建和初始化平台开发控制记录，回滚只删除该控制面表，不删除客户、订单、内容或财务数据。租户/来源端范围、计划日期和审批记录将在执行台完成首轮总部运作后按真实需求进入下一次契约冻结，不能预先虚构字段。

状态只能使用：

- `active`：正在当前门禁收集产物和证据。
- `queued`：等待前置依赖或责任确认。
- `blocked`：已识别明确阻断，不能继续放行。
- `done`：当前工作流全部约定门禁和价值复盘完成。

不得把“页面已创建”“代码已提交”直接等同于完成；完成必须以门禁证据和业务结果为准。

## 首批执行队列

1. 执行中台：确认持久化模型、权限、负责人和证据索引。
2. 对象事件：评审核心对象、关键事件、事实源和消费者。
3. 成交金链：用真实产品、客户和订单打通产品到回款。
4. 实施中心：建立准备度、7/30/90天计划和价值复盘。
5. 机械行业：形成首个不复制代码的行业配置样板。

实施中心队列项落地后，由租户实施工作台承接具体客户计划。执行台继续管理总部开发门禁，实施工作台管理单个客户的阶段证据；两者不得互相替代或以页面存在宣称验收完成。

## 五条黄金业务链

### 收入闭环

`产品与内容 → 询盘与商机 → 报价与合同 → 确认订单 → 发票与回款`

每笔回款必须可追到订单、报价、客户、产品和来源。

首个可运营试点由 `factory_revenue_flow_runs` 和 `/api/v1/factory-platform/projects/{project_id}/revenue-flow` 提供。每条记录绑定经数据库授权的客户计划、`tenant_id`、`client_id`、`plan_id` 与唯一 `correlation_id`，不能跨计划读取或推进。状态机固定为“产品确认→询盘创建→报价提交→报价接受→订单确认→发票开具→回款完成”，跳步、并发旧修订和跨租户ID都会被拒绝。

金额规则为：报价必须大于零；订单不得超过已接受报价；发票不得超过订单；首轮试点只有在回款与发票精确对账时才完成。每次推进产生符合冻结V1契约的事件信封并写审计，不直接替代询盘、报价、订单、发票或财务系统的权威记录。迁移 `b3d5f7a9c124` 回滚时只删除试点链路追踪，不删除各权威业务系统中的源记录。

#### 智能报价应用

`convert.cpq-contract` 已从蓝图规划入口升级为 `/cpq-quotes` 独立试点应用。租户计划内的报价草稿必须包含权威产品与 SKU 引用、数量、MOQ、销售单价、单位成本、交期、币种、汇率和有效期。服务端统一计算小计、成本和毛利，拒绝低于MOQ、低于成本、过期和旧修订报价。

状态固定为 `draft → pending-approval → approved → sent → accepted`。审批必须填写复核意见；发送和买家接受分别产生冻结的 `quote-submitted`、`quote-accepted` 事件并写审计。买家接受后只生成 `order_intent_id`，它明确不是确认订单；只有09履约域或授权OMS/ERP适配器能够确认订单。

API位于 `/api/v1/factory-platform/projects/{project_id}/cpq-quotes`，每次读写均校验项目访问范围。迁移 `f0b3d6a9c427` 回滚只删除CPQ草稿、审批、事件证据和订单意向，不删除产品、确认订单、发票或回款。

### 制造履约

`订单确认 → 物料计划 → 生产批次 → 质量放行 → 发运签收`

订单行必须可追到BOM、工单、批次、检验、库存和发运。

#### 权威订单确认与全球交付应用

`fulfillment.delivery` 已从蓝图规划入口升级为 `/fulfillment-orders` 独立试点应用。它只接收本租户计划内、状态为 `accepted` 的 CPQ `order_intent_id`；登记后状态仍为 `pending-validation`，不能被收入、财务或客户资产应用当作确认订单。

订单确认前必须同时通过产品版本、信用/付款条件、可用库存和交付产能四项检查，填写复核意见，并具备 `factory.fulfillment.order.confirm` 权限。只有四项都通过且冻结的 `order-confirmed` 事件契约存在时，09履约域才生成唯一 `order-*` 权威订单ID。登记、确认和后续履约分别使用 `factory.fulfillment.order.register`、`factory.fulfillment.order.confirm`、`factory.fulfillment.delivery.manage` 权限；总部管理员保留审计明确的应急访问。

履约状态固定为 `confirmed → allocated → in-production → production-completed → quality-released → shipped → delivered`。每一步必须提供业务证据编号和说明，且不能跳步；生产完成、质量放行和签收分别产生冻结的 `production-completed`、`quality-released`、`shipment-delivered` 事件。API位于 `/api/v1/factory-platform/projects/{project_id}/fulfillment-orders`，所有读写均绑定 `agent_path`、`tenant_id`、`client_id`、`plan_id` 和项目访问范围。

迁移 `f4c7a9d2e608` 回滚时只删除本适配器的订单登记、验证快照、履约证据和事件副本，并撤回系统客户/项目角色新增的三项权限；不删除 CPQ 报价、产品事实、外部 OMS/ERP 记录、发票或回款。

### 资产续费

`资产建档 → 保修维护 → 服务闭环 → 到期提醒 → 续费增购`

客户资产必须关联确认订单、产品和序列号；续费机会要关联服务结果和客户价值。

#### 客户资产与服务续费应用

`care.customer-success` 已从蓝图规划入口升级为 `/customer-assets` 独立试点应用。资产只能从本租户计划内状态为 `delivered` 的09权威订单登记，产品与 SKU 必须存在于订单行，租户内序列号唯一，登记数量不得超过订单交付数量。每条资产保存安装位置、安装时间、保修期限、下次维护时间和订单引用，并产生冻结的 `customer-asset-created` 事件；它不复制或修改产品、订单和财务事实。

服务工单状态固定为 `open → scheduled → in-progress → resolved`。工单按紧急程度生成4、8、24或72小时 SLA，排期必须指定负责人和未来时间，解决必须提交服务报告编号与说明，并产生冻结的 `service-resolved` 事件。解决后只更新资产服务次数、最近服务时间和下次维护时间。

保修进入180天窗口后，可由 `factory.care.renewal.manage` 权限用户建立一次到期行动并产生冻结的 `warranty-expiring` 事件；续费行动只是责任任务，仍须重新报价、授权并由09确认订单。登记资产、管理服务和续费行动分别使用 `factory.care.asset.register`、`factory.care.service.manage`、`factory.care.renewal.manage` 权限。

API位于 `/api/v1/factory-platform/projects/{project_id}/customer-assets`。迁移 `f8d1c4a7b902` 回滚只删除资产登记、服务工单、续费信号及事件副本，并撤回系统客户/项目角色新增的三项权限；不删除订单、产品事实、外部服务记录、发票、回款或客户身份。

#### 产品护照与PLM追溯应用

`fulfillment.plm` 已从蓝图规划入口升级为 `/product-passports` 独立应用。工程版本由产品、SKU、工程版本号、规格字典和BOM组成；BOM每一项必须具有物料编号、名称、供应商、正数量、单位和原产国，同一工程版本内物料编号不得重复。首期存量接入只允许从本租户计划内状态为 `delivered` 的09权威订单行采用产品与SKU，后续产品主档上线后仍由PLM拥有工程事实，订单只保留稳定引用。

工程版本状态固定为 `draft → released`。发布必须使用乐观修订号、工程审批依据及说明，并生成冻结的 `engineering-version-released` 事件。发布后的版本不可就地覆盖；任何变更应建立新工程版本，保留旧版本与既有订单、批次和护照的关系。

护照草稿必须关联已发布工程版本和完整履约证据：库存分配、生产工单、生产批次、质量放行、发运及签收六段缺一不可。证书保存类型、编号、签发方、适用地区、生效期、到期日和证据引用；当前未生效、已过期或租户内编号重复的证书不得核验。至少一份当前有效的已核验证书存在后，授权用户才能发布护照。发布时使用规范化工程规格、BOM、订单、六段履约引用和证书清单计算 SHA-256 摘要，并冻结 `product-passport-published` 事件和二维码载荷。

工程维护、工程发布和护照发布分别要求 `factory.fulfillment.engineering.manage`、`factory.fulfillment.engineering.release`、`factory.fulfillment.passport.publish` 权限；创建工程版本、发布工程、创建护照、核验证书和发布护照分别写入审计日志。客户资产通过订单、产品和SKU反查并展示序列号，不在护照表复制资产生命周期。API位于 `/api/v1/factory-platform/projects/{project_id}/product-passports`。迁移 `fa2e6c8d1b03` 回滚只移除PLM快照、护照、证书引用、新权限和新契约，不删除订单、履约证据、客户资产、源证书文件、库存、发票或付款。

### 出海合规

`产品身份 → 材料批次 → 质量证照 → 碳与贸易 → 护照登记`

所有合规字段必须带权威来源、版本、生效时间和责任人审批。

### 智能行动

`授权取数 → 生成建议 → 人工复核 → 责任任务 → 结果复盘`

AI输出必须有事实引用和模型版本，正式业务状态只由授权人员或权威系统修改。

## 版本验收原则

每个产品版本至少完整改善一条黄金业务链。不得以多个互不连接的页面、菜单或原型数量替代端到端验收。

### 质量管理与批次放行应用

`fulfillment.qms` 已从蓝图规划入口升级为 `/quality-inspections` 独立应用。检验单只能引用同一租户计划内已完成生产的权威订单行，并自动继承工单和生产批次；历史订单接入时必须保留原始质量证据编号，禁止为了导入而重写追溯链。

检验状态固定为 `draft → in-progress → review-required → released`。外观、尺寸、性能、安全和文件五项检查必须齐全，抽样合格数与不合格数必须等于样本数。任何失败项都必须建立 NCR；NCR 只有在记录处置方式、根因、纠正措施和证据编号后才能关闭。全部失败项关闭且质量负责人提供审批依据后，QMS 才能冻结 `quality-released` 事件。

OMS 的 `release-quality` 里程碑不再自行制造质量事实，只接受同一项目、同一订单、同一质检编号且状态为 `released` 的 QMS 记录，并同步其冻结事件后进入 `quality-released`。权限拆分为 `factory.fulfillment.quality.inspect`、`factory.fulfillment.quality.resolve` 和 `factory.fulfillment.quality.release`；创建、开始、记录结果、建立 NCR、闭环 CAPA 和批准放行均写入审计日志。API 位于 `/api/v1/factory-platform/projects/{project_id}/quality-inspections`。

迁移 `fb3d7e9a2c14` 回滚时只删除检验单、异常单、复制的证据引用和 QMS 权限，不删除订单、生产批次、客户资产、产品护照、源检验文件、库存、发票或付款。

### 供应采购与收货证据应用

`fulfillment.srm` 已从蓝图规划入口升级为 `/procurement` 独立应用。供应商先建立法定名称、国家、币种、标准交期、风险级别、准入材料范围和审核证据，再由具备权限的负责人批准；没有被批准或准入材料未覆盖工程 BOM 的供应商不得生成采购订单。

采购需求由同一租户计划内已发布工程版本的 BOM 与权威确认订单数量计算，采购人员只能填写逐料单价，不能手工改写材料或需求数量。采购单状态固定为 `draft → pending-approval → approved → issued → acknowledged → received`，分别保留提交说明、审批编号、正式采购文件、供应商确认和仓库收货凭证。

供应商确认的承诺交期只代表外部承诺，不能直接写成库存、到货、质检或财务过账事实。只有仓库提供独立收货编号，且逐料实收数量与采购数量精确一致时，本应用才记录 `received`；后续库存上架、来料检验和应付账款仍由各自权威应用完成。

权限拆分为 `factory.fulfillment.supplier.manage`、`factory.fulfillment.purchase.manage`、`factory.fulfillment.purchase.approve` 和 `factory.fulfillment.receiving.record`。API 位于 `/api/v1/factory-platform/projects/{project_id}/procurement`，供应商建立/批准、采购单建立以及每次状态推进均写审计日志。迁移 `fc4e8a0b3d25` 回滚只删除 SRM 档案、副本和权限，不删除工程版本、BOM、需求订单、库存收货、QMS 检验、源文件、发票或付款。

### 产销计划与有限产能应用

`fulfillment.planning` 已从蓝图入口升级为 `/production-plans` 独立应用。产能资源记录产线编号、理论日产能、班次小时、历史效率和班次日历证据，必须经运营负责人审批后才能进入排程；有效日产能由理论日产能乘以效率计算，工期按工作日向上取整。

生产计划只能引用同一租户计划内的权威确认订单和已发布工程版本。MRP 将订单数量乘以逐项 BOM 用量，并只汇总状态为 `received`、需求订单和工程版本均一致的采购收货数量；供应商承诺、已签发采购单或运输中状态均不能充当可用材料。

计划状态固定为 `draft → pending-review → approved → released`。缺料或有限产能晚于承诺交期时允许保存风险草案并进入协同评审，但释放门禁会拒绝生成生产执行意向。采购到料或产能变化后必须执行重算，重算会把计划恢复为 `draft` 并撤销旧评审和审批，防止旧结论继续开工。只有材料 `ready`、排程 `on-time` 且具备释放依据时，才生成唯一 `work_order_intent_reference`；该意向不是 MES 工单，仍需制造执行应用接管。

权限为 `factory.fulfillment.capacity.manage`、`factory.fulfillment.planning.manage`、`factory.fulfillment.planning.approve` 和 `factory.fulfillment.planning.release`。API 位于 `/api/v1/factory-platform/projects/{project_id}/production-plans`。迁移 `fd5f9b1c4e36` 回滚只删除产能快照、计划、MRP计算副本、里程碑和权限，不删除订单、工程BOM、采购单、库存收货、工单、QMS、发票或付款。

### 制造执行与生产谱系应用

`fulfillment.mes` 已从蓝图入口升级为 `/manufacturing-execution` 独立应用。MES 只接收产销计划产生的唯一 `work_order_intent_reference`，一个租户内同一生产计划只能生成一张制造工单；工单建立时必须冻结生产批次、逐料批次号、领料数量、真实收货凭证和有序工艺路线，计划意向本身不能直接冒充车间工单。

工单状态为 `draft → released → in-progress/paused → ready-to-complete → completed`。工序必须按顺序启动，同一工单只能有一道活动工序；每道工序的良品加报废必须精确等于该工序投入，下一道工序只接收上一道工序的良品。停机只能挂在当前活动工序上，停机未记录维修说明和恢复证据前禁止报工；最终良品和累计报废由完整工艺谱系计算，不能由页面手填覆盖。

权限拆分为 `factory.fulfillment.mes.manage`、`factory.fulfillment.mes.operate` 和 `factory.fulfillment.mes.supervise`。API 位于 `/api/v1/factory-platform/projects/{project_id}/manufacturing-execution`，工单建立/释放/关闭、工序开始/完成、停机建立/恢复均写入独立审计事件。迁移 `fe6a0c2d5f47` 回滚只删除 MES 工单、报工、停机证据和权限，不删除计划、订单、BOM、采购收货、QMS、产品护照、发票或付款。

### 现场服务、客户签收与 SLA 应用

`care.service-sla` 已从蓝图占位入口升级为 `/field-service` 独立应用。客户资产服务工单继续作为问题、严重度和 4/8/24/72 小时 SLA 的唯一身份；现场服务访问只引用该工单，禁止创建第二套问题主档。派工必须选择已审核、具备技能和服务区域的工程师，排期超过 SLA 时必须登记升级凭证。

现场执行状态固定为 `dispatched → en-route → on-site → in-progress → completed`，出发、到场和开工必须按序并分别留证。完成前至少具备诊断与正工时记录、解决报告、客户签收人、签收凭证和下次维护日期；超时完成必须追加升级依据。备件使用要求物料、数量、单位及库存领用凭证，但现场服务不直接改库存、不生成发票或成本凭证。

权限拆分为 `factory.care.field-service.manage`、`factory.care.field-service.dispatch`、`factory.care.field-service.execute` 和 `factory.care.field-service.complete`。API 位于 `/api/v1/factory-platform/projects/{project_id}/field-service`。迁移 `ff7b1d3e6a58` 回滚只删除工程师授权、现场访问、工作证据和权限；不删除客户资产、基础服务工单、订单、QMS、库存、发票或付款。

### 质保退货与 RMA 应用

`care.warranty-rma` 已从蓝图占位入口升级为 `/warranty-rma` 独立应用。每张 RMA 只能引用同一租户计划内、同一客户资产的已解决服务工单；资产序列号、原订单、产品、SKU 和质保截止日作为提交时资格快照。过保申请不能由页面直接放行，必须追加独立善意授权依据。

RMA 状态固定为 `draft → pending-review → authorized → return-in-transit → received → inspected → disposition-approved → closed`。客户交运与仓库真实收货是两个不同事实；仓库收货还必须记录设备状态。制造缺陷判定必须引用独立 QMS 凭证，确认制造缺陷后不得选择无补救拒赔。退款处置必须产生财务跟进编号，供应商责任必须产生追偿编号，但本应用只记录这些协作引用，不直接修改库存、应收、应付、退款或付款事实。

处置审批分别记录维修、换货、退款、拒赔或报废，责任归属和零件、工时、物流预计成本；闭环必须同时具备补救结果和客户确认。权限拆分为 `factory.care.rma.manage`、`factory.care.rma.authorize`、`factory.care.rma.receive`、`factory.care.rma.inspect` 和 `factory.care.rma.disposition`。API 位于 `/api/v1/factory-platform/projects/{project_id}/warranty-rma`。迁移 `a08c2e4f7b69` 回滚只删除 RMA 快照、退回证据和权限，不删除客户资产、服务工单、订单、仓库收货、QMS、库存、发票、退款或付款。

### 续约复购与增购应用

`care.renewal-growth` 已从通用商机入口升级为 `/renewal-growth` 独立应用。机会只能来自状态为 `active` 且已经执行到期行动的客户资产；建立时冻结资产修订、剩余保修天数、已解决服务、已闭环 RMA 和制造责任次数，并用公开公式形成健康分与低中高风险。系统不把健康分包装成 AI 预测，也不在缺少客户证据时自动推荐采购。

状态固定为 `draft → assessed → recommended → approved → cpq-requested → quoted → won`，已评估机会也可携带损失证据进入 `lost`。建议阶段必须保留客户目标与确认编号、续约/复购/增购动作、推荐产品和SKU、数量、预计单价、成本、毛利及依据；批准和 CPQ 移交由不同权限控制。

`quoted` 只接受同一租户计划内状态为 `accepted` 的 CPQ 报价，且报价行必须覆盖批准的产品、SKU和数量；资产原订单的报价不能重复作为续约报价。`won` 只接受由该报价产生、客户一致并已经通过 OMS 产品、付款、库存和产能校验的正式订单。应用保存关联和证据副本，但不修改客户资产、原订单、报价审批、库存、发票、付款或回款。

权限拆分为 `factory.care.renewal-growth.manage`、`factory.care.renewal-growth.assess`、`factory.care.renewal-growth.approve`、`factory.care.renewal-growth.handoff` 和 `factory.care.renewal-growth.confirm`。API 位于 `/api/v1/factory-platform/projects/{project_id}/renewal-growth`。迁移 `b19d3f5a8c70` 回滚只删除续约机会快照、追加式证据和权限；不删除或改写客户资产、服务工单、RMA、CPQ报价、OMS订单、库存、发票或付款。
