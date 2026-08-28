# AI 引用监测运营契约

`recommend.citation` 的唯一事实源是带范围的观察快照：`监测范围 → 不可变观察快照 → 异人核验 → 受控分析交接 → 独立批准 → 消费者回执`。它只记录在特定模型、问题、国家/市场、语言和时间窗中的可复核观察；不调用、控制或更改外部模型。

## 三端共享职责

总部登记监测范围与观察证据，且只能创建范围或捕获安全的观察清单；代理必须由不同操作者复核观察哈希及范围；客户市场、GEO 或经营责任人只能回执已批准的分析交接。所有数据投影和审计证据绑定 `project_id`、`agent_path`、`tenant_id`、`client_id` 与 `plan_id`，并按权限分别执行创建、核验、批准和回执。

## 共享对象、事件与回滚

迁移 `e1f4a7b9c306` 登记冻结对象 `citation-observation` 和事件 `citation-analysis-released`，并创建租户隔离的监测、观察、交接和证据表。回滚只删除本应用的治理投影、权限与共享契约；绝不删除客户内容、源事实、外部模型输出或其他应用记录。

## 商业与自动化边界

Citation monitoring boundaries: the service never automatically changes content, websites, advertising, or external model settings; it never guarantees a citation, appearance, recommendation, visibility, or ranking. 观察结果是时间敏感的研究证据，不是搜索或模型平台的结果承诺；任何后续内容、站点或投放动作必须由其所属应用重新审核和发布。

只有租户权限、审计、迁移、独立核验/批准/回执测试、真实页面验收、TypeScript、生产构建和 H 版本证据全部通过时，`recommend.citation` 才能从 `pilot` 提升为 `available`。
