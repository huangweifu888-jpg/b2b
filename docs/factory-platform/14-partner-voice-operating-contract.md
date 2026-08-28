# 经销商与客户之声运营契约

`care.partner-voice` 的目标不是收集孤立评价，而是把可验证的伙伴关系、客户反馈整改、客户确认和授权倡导连成长期客户价值闭环。正式应用路由为 `/partner-voice`，平台蓝图、栏目配置、运营市场、左侧导航、页面锁定器和共享开发契约均读取同一应用定义。

## 权威事实边界

- 伙伴可关联客户账户，但该账户必须由本租户计划内的权威 OMS 订单或客户装机资产证明。
- 客户反馈只能引用同一客户的订单、资产和已审批伙伴，不复制或改写 CRM、订单、资产、库存、发票、回款和财务事实。
- NPS 只接受 0—10 分，9—10 为推荐者、7—8 为中立者、0—6 为贬损者；平台按有效反馈实时计算 NPS，不允许页面手填指标。
- 严重反馈或贬损者反馈必须在 48 小时内进入责任处理，并在解决时提供升级证据。
- 客户案例必须来自已关闭且客户确认的推荐者反馈，经过邀请、明确授权范围、授权有效期校验后才能发布。不得用奖励诱导虚假评价，不得超范围使用联系人、商标或案例材料。

## 固定状态机

伙伴准入：

`draft → active`，建立档案与审批开通使用不同权限；开通需要合同编号和审批说明。

伙伴学院：

`enrolled → completed → certified`，考核分数低于课程及格线不得完成，认证必须有凭证和未来到期日。

客户反馈：

`received → triaged → action-in-progress → resolved → customer-confirmed → closed`

每一步需要乐观修订号和追加式证据。已解决不等于客户确认，客户确认也不等于允许公开宣传。

客户倡导：

`not-eligible | eligible → invited → authorized → published`

只有满足真实评分和完整反馈闭环的记录才能进入 `eligible`。发布渠道必须包含在当前授权范围和有效期内。

## 权限与审计

权限拆分如下：

- `factory.care.partner-voice.partner.manage`：建立伙伴档案。
- `factory.care.partner-voice.partner.approve`：独立审批伙伴开通。
- `factory.care.partner-voice.academy.manage`：分配课程、登记考核和签发认证。
- `factory.care.partner-voice.voice.manage`：登记、分诊和启动反馈行动。
- `factory.care.partner-voice.voice.resolve`：解决、客户确认和关闭反馈。
- `factory.care.partner-voice.advocacy.publish`：登记授权并发布客户案例。

伙伴创建/开通、学院分配/完成/认证、反馈接收/分诊/行动/解决/确认/关闭、倡导邀请/授权/发布分别写入独立审计事件。所有记录携带 `agent_path`、`tenant_id`、`client_id`、`plan_id` 和 `project_id`，并用 `expected_revision` 拒绝旧修订覆盖。

## API 与页面契约

API 根路径：`/api/v1/factory-platform/projects/{project_id}/partner-voice`。

- `GET /`：伙伴、学院、反馈、权威客户账户和 NPS 指标工作区。
- `POST /partners`、`POST /partners/{id}/activate`：伙伴准入。
- `POST /academy`、`POST /academy/{id}/complete`、`POST /academy/{id}/certify`：伙伴学院。
- `POST /voices` 以及 `/triage`、`/start-action`、`/resolve`、`/confirm`、`/close`：VOC/NPS 闭环。
- `POST /voices/{id}/advocacy-invite`、`/advocacy-authorize`、`/advocacy-publish`：授权倡导。

页面必须展示权威客户订单/资产引用、伙伴审批状态、学院认证、实时 NPS、反馈证据、客户确认和授权发布状态。页面按钮只推进相邻状态，不得提供跳步或直接覆盖状态的入口。

## 商业运营验收

完整验收至少证明：

1. 由真实订单或装机资产建立伙伴，独立审批后开通。
2. 分配伙伴课程，考核达标后签发带到期日的认证。
3. 录入关联同一账户、订单与资产的真实 NPS 反馈。
4. 顺序完成分诊、行动、解决、客户确认和关闭，并保留追加式证据。
5. 推荐者反馈关闭后形成可邀请状态，只有登记明确授权范围和有效期后才允许在指定渠道发布。
6. NPS 指标由有效记录自动得出，源订单和资产修订号及业务状态保持不变。
7. 六类权限、全部审计事件、租户隔离、生产构建和真实浏览器操作同时通过。

## 迁移与回滚

迁移 `c2ae4b6d9f81` 创建伙伴、伙伴学院、VOC/NPS 和追加式证据表，并授予六类权限。回滚只移除本应用的快照、证据和权限授权；不得删除或改写 CRM 联系人、客户资产、订单、服务记录、源反馈文件、已发布媒体、发票或付款事实。回滚前必须先导出仍需依法留存的客户授权和公开案例清单。
