# B2B/B2C 工厂平台蓝图

本目录描述工厂平台十二类能力及两条受控发布分支：`总部端 → 代理源端 → 代理端`，或 `总部端 → 客户源端 → 客户计划/站点`。总部不得跳过来源端直达运行实例，代理源端与客户源端也不得互相发布。文档用于统一产品、研发、实施、销售和运营口径，不替代具体项目合同、财税意见、数据合规评估或各系统的接口说明。

## 目标

- 把可复用能力沉淀为版本化模板、模块、页面方案和连接器，减少重复建设。
- 把总部端、代理源端、客户源端及各自运行实例的所有权和发布边界写清楚，避免模板更新覆盖下游业务数据与自定义内容。
- 用分阶段验收和可回退发布控制交付风险，并为国内、海外、B2B、B2C及 ERP 集成保留扩展路径。

## 十二大类总览

平台采用同一条客户经营闭环：`01.蓄势(身份)`、`02.布场(内容)`、`03.营搜(信任)`、`04.占新(推荐)`、`05.圈养(深耕)`、`06.锁客(画像)`、`07.精投(截流)`、`08.承转(转化)`、`09.强链(履约)`、`10.深养(伴护)`、`11.驭数(决策)`、`12.固本(经营)`，再回到下一轮蓄势。分类定义、应用项目、唯一事实源与边界详见运作模型。固本位于客户可理解路径的第12步，但作为组织、财务、法务和主数据底座，必须从建设第一天横向参与，并不表示最后才开发。

`frontend/src/lib/factory-platform-blueprint.ts` 是类别、应用、阶段和销售价值的程序事实源；本目录负责解释其运行、边界、验收和销售限制。若程序与文档不一致，必须作为发布阻断问题处理，不得选择性引用。

## 三阶段总览

- **P0 / `revenue-loop` / 收入闭环**：先建设经营治理、身份内容、搜索社交、授权画像、付费获客、询盘报价、客户经营和基础决策。
- **P1 / `manufacturing-loop` / 制造履约闭环**：建设产品工程、供应、计划、制造、质量、确认订单、全球交付、售后和人力协同。
- **P2 / `global-intelligence` / 全球智能增长**：建设GEO、知识图谱、本地化、深度洞察、智能投放、预测和AI决策。

同一类别可包含多个阶段的应用，排期以每个应用的 `phase` 为准，不能以类别默认阶段替代应用级判断。

## 核心原则

1. **源与实例分离**：总部维护平台标准；代理源端和客户源端分别维护获准的来源包；代理端和客户计划/站点保存自己的业务数据和被允许的自定义。
2. **配置与数据分离**：样式、页面组合、模块开关可同步；客户、订单、合同、素材等业务数据不得被模板发布覆盖。
3. **先预演后发布**：每次变更先生成影响范围、差异和恢复点，再按发布环逐级放量。
4. **事实型销售**：只陈述已经上线、可演示或有验收口径的能力；效果目标用前提、范围和验证方法表达。
5. **连接器隔离**：ERP、支付、物流、消息和营销平台通过适配层接入，不把供应商字段渗透到核心领域模型。

## 文档导航

- [01-operating-model.md](./01-operating-model.md)：12 类运作逻辑、责任和边界。
- [02-development-roadmap.md](./02-development-roadmap.md)：P0、P1、P2 的建设顺序、依赖与验收。
- [03-customer-value-and-sales.md](./03-customer-value-and-sales.md)：客户买点、竞品差异和可核验销售话术。
- [04-global-b2b-b2c.md](./04-global-b2b-b2c.md)：国内/海外、B2B/B2C 模式与 ERP 连接策略。
- [05-three-end-governance.md](./05-three-end-governance.md)：总部端、代理源端、客户源端及两条发布分支的治理规则。
- [06-platform-foundations.md](./06-platform-foundations.md)：六大横向平台底座、公共能力和技术不变量。
- [07-commercial-packages.md](./07-commercial-packages.md)：四档商业套餐、计费边界和客户价值证明。
- [08-application-contract-and-delivery-flow.md](./08-application-contract-and-delivery-flow.md)：十五个应用字段、七道门禁和最小交付包。
- [09-priority-programs-and-continuous-roadmap.md](./09-priority-programs-and-continuous-roadmap.md)：五个优先专项与持续开发七步顺序。
- [10-execution-desk-and-golden-flows.md](./10-execution-desk-and-golden-flows.md)：开发执行台、首批队列与五条黄金业务链。
- [11-object-event-dictionary.md](./11-object-event-dictionary.md)：21个核心对象、12个关键事件和事实源规则。
- [12-configuration-packs.md](./12-configuration-packs.md)：六个行业包、五个国家区域包及配置边界。
- [13-implementation-and-portability.md](./13-implementation-and-portability.md)：7/30/90天实施中心与数据可迁移退出。
- [14-partner-voice-operating-contract.md](./14-partner-voice-operating-contract.md)：伙伴准入、客户学院、VOC/NPS整改、客户确认与授权倡导运营契约。
- [15-health-cockpit-operating-contract.md](./15-health-cockpit-operating-contract.md)：跨系统经营健康快照、异常责任任务、独立验证与权威来源边界。
- [16-data-warehouse-operating-contract.md](./16-data-warehouse-operating-contract.md)：受控来源、不可变事实版本、质量门禁、逐批血缘与独立发布契约。
- [17-metric-semantics-operating-contract.md](./17-metric-semantics-operating-contract.md)：稳定指标身份、不可变口径版本、仓库血缘计算与独立验证发布契约。
- [18-revenue-profit-operating-contract.md](./18-revenue-profit-operating-contract.md)：触点证据、回款成本事实绑定、渠道管理贡献分摊及与正式财务利润的边界契约。
- [19-forecast-operating-contract.md](./19-forecast-operating-contract.md)：六类已发布事实快照、需求产能现金滚动预测、策略版本、独立复核及非正式财务预测边界。
- [20-ai-command-operating-contract.md](./20-ai-command-operating-contract.md)：带修订引用的授权问数、零回写情景、异人审批建议和目标业务系统交接闭环。
- [21-erp-operating-contract.md](./21-erp-operating-contract.md)：OMS确认订单引用、经营组织与成本中心、不可变经营记账和独立月结底账契约。
- [22-finance-operating-contract.md](./22-finance-operating-contract.md)：正式权责发生制账簿、应收应付与收付款、平衡复式分录、试算余额和独立关账契约。
- [23-people-operating-contract.md](./23-people-operating-contract.md)：组织、岗位、员工、合同、工时、绩效与培训的数据最小化、职责分离和独立复核契约。
- [24-recruiting-operating-contract.md](./24-recruiting-operating-contract.md)：岗位编制、候选人授权、结构化面试、AI辅助边界、人工录用决定、Offer与HR交接契约。
- [25-approval-center-operating-contract.md](./25-approval-center-operating-contract.md)：跨业务来源版本固定、顺序审批、移动端同等校验、限时代理、显式业务交接与审计契约。
- [26-contract-legal-operating-contract.md](./26-contract-legal-operating-contract.md)：法律主体、不可变模板、独立法审、受控用印、第三方签署、履约义务与商业来源不回写契约。
- [27-icp-customer-profile-operating-contract.md](./27-icp-customer-profile-operating-contract.md)：不可变ICP、采购委员会、购买场景、权威来源证据、可解释评分与下游确认契约。
- [46-icp-availability-contract.md](./46-icp-availability-contract.md)：ICP 当前版本可用性证据、来源不改写边界与回滚说明。
- [47-brand-positioning-availability-contract.md](./47-brand-positioning-availability-contract.md)：品牌定位与网站风格的证据、发布边界与回滚说明。
- [48-digital-assets-availability-contract.md](./48-digital-assets-availability-contract.md)：AI建站计划、数字资产权利、受控交接与不自动发布边界的可用性证据。
- [28-dam-localization-operating-contract.md](./28-dam-localization-operating-contract.md)：私有素材指纹、版权范围、不可变术语、异人质量复核、国家内容包与下游确认契约。
- [29-enterprise-knowledge-graph-operating-contract.md](./29-enterprise-knowledge-graph-operating-contract.md)：六类权威实体、来源指纹、异人关系验证、不可变图谱版本与下游确认契约。
- [30-structured-data-operating-contract.md](./30-structured-data-operating-contract.md)：图谱版本固定、五类Schema映射、异人验证、不可变JSON-LD发布与渠道确认契约。
- [31-channel-feed-operating-contract.md](./31-channel-feed-operating-contract.md)：渠道凭证引用、商品事实固定、价格库存边界、异人验证、不可变Feed发布与渠道回执契约。
- [32-identity-resolution-operating-contract.md](./32-identity-resolution-operating-contract.md)：同意用途边界、不可逆身份哈希、异人核验与裁决、不可变黄金档案和下游回执契约。
- [33-account-graph-operating-contract.md](./33-account-graph-operating-contract.md)：法务、身份、商机和履约权威节点，企业关系异人核验、不可变版本与下游回执契约。

- [39-ai-sdr-operating-contract.md](./39-ai-sdr-operating-contract.md)：已验证 ICP 证据、AI 建议、人工资格审核、不可变销售交接与回执契约。
- [40-rfq-sample-operating-contract.md](./40-rfq-sample-operating-contract.md)：权威询盘固定、技术需求异人审核、样品成本与范围审批、发运、客户反馈和销售回执契约。
- [41-commerce-operating-contract.md](./41-commerce-operating-contract.md)：B2B报价订货、B2C权威商品结账、条款与支付异人核验、不可变订单意向和OMS回执契约。
- [42-platform-72-completion-acceptance.md](./42-platform-72-completion-acceptance.md)：十二类72应用零占位完成口径、最终验收证据及从试点升级正式可售的治理边界。
- [43-product-intelligence-availability-contract.md](./43-product-intelligence-availability-contract.md)：产品分析五类来源信号、异人核验、六类商业证据和当前版本正式可用验收记录。
- [44-market-radar-availability-contract.md](./44-market-radar-availability-contract.md)：市场雷达五类国家机会信号、进入决策、异人复核与当前版本发布证据门禁。
- [45-competitive-pricing-availability-contract.md](./45-competitive-pricing-availability-contract.md)：竞品报价快照、价格带决策、报价边界与当前版本发布证据门禁。
- [52-product-content-operating-contract.md](./52-product-content-operating-contract.md)：产品事实引用、渠道内容版本、异人复核、受控交接与不改写产品主档的契约。
- [53-content-proof-operating-contract.md](./53-content-proof-operating-contract.md)：案例、新闻、视频和博客的来源授权、受控证明发布与消费者回执契约。
- [76-content-commerce-experience-spec.md](./76-content-commerce-experience-spec.md)：02.布场的全球 B2B/B2C 多站、多语言、前后域、可视化编辑、AI 沙盘、品牌风格、三端同步与注册商连接器实施规范。
- [77-website-build-to-operation-contract.md](./77-website-build-to-operation-contract.md)：从立项、内容、设计、多语言、路由、转化、验收、灰度上线到 30/90 天运营的客户网站交付规范。
- [78-website-build-program-operating-contract.md](./78-website-build-program-operating-contract.md)：建站总控的项目事实源、七阶段独立门禁、三端共享契约、发布回执与运营激活边界。
- [54-technical-seo-operating-contract.md](./54-technical-seo-operating-contract.md)：技术SEO健康证据、异人核验、可回退修复交接与站点负责方回执契约。
- [55-keyword-map-operating-contract.md](./55-keyword-map-operating-contract.md)：来源日期、主题意图、异人核验、受控交接与内容消费者回执契约。
- [56-onpage-seo-operating-contract.md](./56-onpage-seo-operating-contract.md)：页面来源、TDK/内链建议、异人复核与内容负责人回执契约。
- [57-search-share-operating-contract.md](./57-search-share-operating-contract.md)：搜索表现数据集、趋势分析边界与未来三端交接门槛。
- [58-reputation-operating-contract.md](./58-reputation-operating-contract.md)：公开提及、口碑处置与不造假边界。
- [59-proof-center-operating-contract.md](./59-proof-center-operating-contract.md)：企业证明资产、有效期核验与受控页面交接边界。
- [60-geo-aeo-operating-contract.md](./60-geo-aeo-operating-contract.md)：买家问题、来源绑定答案、独立核验与受控交接边界。
- [61-fact-library-operating-contract.md](./61-fact-library-operating-contract.md)：权威事实卡、不可变版本与内容消费者交接边界。
- [62-citation-monitoring-operating-contract.md](./62-citation-monitoring-operating-contract.md)：范围化 AI 引用观察、异人核验、受控分析交接与不承诺排名边界。

## 使用方式

- [63-inquiry-routing-operating-contract.md](./63-inquiry-routing-operating-contract.md)：全渠道询盘、异人审核、规则治理、接收回执和收入黄金链路交接的正式可用契约。

- [34-buying-committee-operating-contract.md](./34-buying-committee-operating-contract.md)：CPQ 商机、ICP 采购角色、授权联系人、异人核验影响路径、不可变版本与下游回执契约。
- [35-customer-timeline-operating-contract.md](./35-customer-timeline-operating-contract.md)：内容触点、询盘、报价、订单、服务五类权威事件，异人核验、关键节点、不可变版本与下游回执契约。
- [36-segments-consent-operating-contract.md](./36-segments-consent-operating-contract.md)：有效同意、已核验身份、确定性分群规则、不可变版本、撤回排除与四渠道回执契约。
- [59-cdp-operating-contract.md](./59-cdp-operating-contract.md)：同账户身份、旅程与同意分群的冻结指针数据产品；不复制原始标识、来源漂移拦截、四类消费者独立回执与回滚边界。
- [37-enterprise-targeting-abm-operating-contract.md](./37-enterprise-targeting-abm-operating-contract.md)：有效同意分群、完整采购委员会、角色协同剧本、不可变计划与四系统回执契约。
- [38-creative-center-operating-contract.md](./38-creative-center-operating-contract.md)：ABM采购角色、权利合规内容包、AI人工审核、不可变创意版本与四渠道回执契约。

- 产品立项时，先从运作模型选择业务类别，再从路线图确定优先级和验收门槛。
- 方案设计时，按全球经营文档确认区域、交易模式和系统记录源，再设计接口与数据归属。
- 销售和实施时，用客户价值文档形成发现问题、演示和试点口径，禁止把路线图能力表述为现有能力。
- 发布和运维时，按三端治理文档执行差异预演、审批、灰度、审计与回退。
- 持续开发时，先补齐十五个应用字段，再依次通过立项、契约、安全、开发、业务、发布和价值七道门禁。
- 版本验收时，至少完整改善一条黄金业务链，并在执行台记录责任、阻断、证据和下一动作。

## 应用状态约定

P0/P1/P2只表示建设阶段，不表示当前可售状态。应用的 `deliveryStatus` 由程序的能力注册、发布环和验收证据共同标识，文档不得自行把应用升级为“已具备”。

| 标记 | 含义 |
| --- | --- |
| 已具备（`available`） | 当前发布版本的能力注册标为可用，真实路由、权限、关键流程、监控和回退均通过证据门禁 |
| 试点（`pilot`） | 程序标为试点，并限制在明确客户/区域/连接器白名单、期限和支持责任内 |
| 规划（`planned`） | 程序标为规划，只能进入统一蓝图说明页，不作为当前可交付能力 |

当前程序会为每个应用生成 `deliveryStatus`：显式标识优先；未显式标识时，统一蓝图路由归为 `planned`，既有真实业务路由归为 `pilot`；只有完成当前版本证据门禁后才能显式升级为 `available`。页面、报价和演示必须读取该程序字段，不能仅凭路由存在或P0/P1/P2阶段推断可售状态；状态读取失败时按规划隐藏可售动作。

栏目状态与交付状态是两条独立契约：“开通 / 取消 / 隐藏”只控制产品市场、栏目配置和左侧导航中的目录展示，不会修改 `deliveryStatus`。因此规划应用可以参与栏目编排和导航预置，但仍须持续显示“规划”标识，不能因栏目被开通就宣传为已经交付。

## 六处同源同步

`frontend/src/lib/factory-platform-blueprint.ts` 是十二类、72个一级应用和二级规划的唯一事实源。每个一级应用由蓝图生成一个四字 `navigationLabel`；有二级规划时，由能力清单生成不超过四字的 `navigationChildren`，同时保留完整名称用于说明、提示和后续编辑。

同一投影必须被六处共同消费：平台蓝图、栏目配置、运营市场、左侧栏导航、页面锁定器、规范说明生成器。禁止在这六处另建应用名称、排序或路由副本；新增应用只改蓝图，随后由契约闸门验证12类顺序、72个一级、四字命名、二级路由和锁定记录。
