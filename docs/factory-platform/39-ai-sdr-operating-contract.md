# AI 售前 SDR 运营契约

## 1. 客户买点

AI 售前不是自动群发机器人，而是把已验证 ICP 适配证据、AI 补全建议、人工资格审核和销售接单回执连接成可审计闭环。客户得到的是更快且更稳的首轮判断，同时保留销售人员对客户资格、回复内容和跟进动作的最终决定权。

## 2. 权威来源与边界

- 只接收状态为 `verified` 的 ICP 适配评估，并固定 ICP 版本、定义哈希、适配等级和权威业务来源修订号。
- 每次生成、审核和交接前重新校验 ICP 与业务来源；任一来源漂移立即阻断。
- 只保存企业引用的不可逆哈希，不保存原始联系人姓名、邮箱、电话或提示词正文。
- AI 只生成补全摘要、意向分、资格建议、回复草稿和下一动作，不得自动定级、自动回复或写回 CRM。

```text
source_records_copied = false
verified_icp_assessment_required = true
authoritative_source_revalidated = true
ai_output_direct_qualification = false
ai_output_direct_reply = false
recommendation_self_review = false
raw_contact_identifier_stored = false
prompt_content_stored = false
crm_writeback = false
immutable_handoff_manifest = true
acknowledgement_required = true
```

## 3. 状态机与职责分离

- 售前线索：`draft → pending-review → qualified / nurture / disqualified`
- AI 建议：`pending-review → approved / rejected`
- 销售交接：`pending → acknowledged`

建议生成者不得自行审核；未通过人工审核的建议不得交接；交接创建者不得自行回执。拒绝建议会保留证据但不会产生销售交接。

## 4. 权限、租户与审计

- `factory.convert.ai-sdr.manage`
- `factory.convert.ai-sdr.review`
- `factory.convert.ai-sdr.handoff`
- `factory.convert.ai-sdr.handoff.acknowledge`

四张业务表都携带 `project_id`、`agent_path`、`tenant_id`、`client_id`、`plan_id`。所有写操作记录 `factory.ai-sdr.*` 审计，跨项目读取必须为空。

## 5. 验收指标

- 售前线索数、人工复核率、合格线索数、平均意向分。
- 销售交接数、交接回执率。
- 完成条件：来源未漂移，人工复核率和销售回执率均为 100%，交接清单哈希可复算，未保存原始联系人或提示词正文，未改写 CRM。

## 6. 迁移与回滚

迁移为 `9d3f6b1c8e50`，上游为 `8c2e5a0b7d49`。回滚前导出线索投影、AI 输出哈希、人工审核证据、交接清单与回执；回滚只删除 AI 售前投影和权限，绝不修改 ICP、询盘、CPQ、CRM 或客户标识。

## 7. 开发与验收顺序

1. Alembic 升级、回滚、再升级。
2. 专属测试覆盖异人审核、来源漂移、租户隔离和零 CRM 写回。
3. TypeScript、平台蓝图契约、15 道门禁和生产构建。
4. 总部、代理和客户身份完成真实 API 线索、建议、审核、交接、回执。
5. 数据库复算 ICP 来源、AI 输出、交接哈希、证据、审计与权限。
6. 真实页面核对指标、左侧导航、面包屑和横向溢出。
