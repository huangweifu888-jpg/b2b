# 私域社群运行契约

私域社群是面向工厂客户、经销商和合作伙伴的企业关系运营工作台。它只关联已独立核验的 B2B CRM 企业账户，并把活动交接做成可审计的内部流程；不是群聊账户管理器、私信采集器或自动群发工具。

## 生命周期与权限

创建社群时固定已核验企业账户的指纹；不同成员使用 `factory.deepen.community.verify` 独立核验。通过核验的社群才可计划教育、产品或服务活动；活动计划、独立审批及接收确认分别由 `factory.deepen.community.activation.plan`、`.approve` 和 `.acknowledge` 约束，并带项目范围、乐观锁和审计记录。

## 三端共享边界

总部端建立企业关系标准，代理端承担独立核验与活动审批，客户项目端决定活动计划和接收。三端只共享企业账户指纹、社群状态、活动清单与交接证据。系统不存储成员姓名、手机号、邮箱、私信或群聊凭据，并明确承诺 `member_personal_data_stored=false`、`automatic_member_contact_dispatched=false` 与 `external_community_action_dispatched=false`。

## 迁移与回滚

迁移 `f2a8c5d7e901` 新增社群和活动交接投影、五项项目权限及对象/事件契约。回滚只移除本应用的投影、权限和契约，不删除既有 CRM 企业账户、审计证据或任何外部社群数据。
