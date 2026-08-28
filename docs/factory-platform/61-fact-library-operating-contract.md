# AI 可读事实库运营契约

`recommend.fact-library` 的唯一事实源为权威来源和依据绑定的事实卡：`事实标识、来源与权威依据 → 不可变事实版本 → 异人核验 → 受控交接 → 独立批准 → 内容消费者回执`。每条记录绑定 `project_id`、`agent_path`、`tenant_id`、`client_id` 和 `plan_id`。

## 三端共享职责

总部登记事实、来源与权威依据；代理或独立审核人核验事实版本且不得与作者相同；客户侧的内容、GEO 或结构化数据责任人只在独立批准后确认接收。前端、总部、代理和客户通过同一工作区 API 读取同一状态机。

## 契约、回滚与边界

迁移 `f8a1c3e6b205` 冻结对象契约 `ai-readable-fact-version` 与事件契约 `ai-readable-fact-released`，并提供事实管理、版本核验、交接批准和消费者回执权限。回滚只移除事实库治理投影、权限和契约，绝不删除产品、企业、质量或服务事实源。

**Fact library boundaries:** the service never mutates source facts, never automatically publishes content, and never accepts model-generated text as an authoritative fact.

只有租户权限、审计、迁移、独立核验/批准/回执测试、真实页面验收、TypeScript、生产构建及 H 版本证据全部通过时，`recommend.fact-library` 才可从 `pilot` 提升为 `available`。
