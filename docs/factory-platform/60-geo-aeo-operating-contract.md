# GEO/AEO 中心运营契约

`recommend.geo-aeo` 以问题与答案版本库为唯一事实源：`买家问题引用 → 来源绑定答案版本 → 异人核验 → 受控发布交接 → 消费者回执`。每条记录必须绑定项目、代理、租户、客户与计划。

GEO/AEO 只复用已核验的企业、产品、证明和内容事实；不改写来源内容，不自动发布站点，不承诺 AI 答案展示、引用、推荐或排名。

## 三端职责、共享契约与回滚

总部登记买家问题、目标市场和语言区域，并固化来源绑定答案版本；代理或独立审核人必须与答案作者不同，才能核验未被篡改的来源事实；客户内容、GEO 或市场责任人仅能在独立批准后确认收到交接。所有记录均绑定 `project_id`、`agent_path`、`tenant_id`、`client_id` 和 `plan_id`；前端、总部、代理和客户三端读取同一个工作区 API 与同一个状态机。

迁移 `d9e2f5a3b410` 冻结对象契约 `geo-aeo-answer-version` 与事件契约 `geo-aeo-handoff-released`，并写入问题管理、答案核验、交接批准和回执权限。回滚仅撤回本应用的治理投影、权限和契约，绝不删除企业内容、网站、外部模型结果或客户原始事实。

**GEO/AEO boundaries:** source questions and source-bound answers are never mutated by this service. No site is automatically published, and no AI appearance, citation, recommendation or ranking is guaranteed.

## 可用性门槛

只有租户隔离、审计 API、冻结对象与事件契约、迁移演练、独立核验/批准/回执测试、三端真实页面验收、TypeScript 与生产构建、H 版本证据全部通过后，`recommend.geo-aeo` 才能从 `pilot` 提升为 `available`。
