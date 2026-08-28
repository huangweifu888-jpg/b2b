# 身份合并与黄金档案运营契约

## 1. 经营目的与客户买点

身份合并把分散在网站、CRM、CDP、服务和广告触点中的账户、联系人、邮箱与设备信号，合并为同一个可审计客户身份。客户购买的不是“把数据拼到一起”的黑盒，而是一条在同意、用途、权限和来源边界内运行的身份治理链：原始标识不入库、每个信号固定来源、匹配理由可解释、合并必须人工裁决、黄金档案版本不可变、下游必须对精确哈希回执。

它与普通客户去重工具的核心差异，是“不以提高匹配率为理由牺牲合规和可追溯性”。营销可获得一致受众，销售可看到统一账户，服务可识别连续旅程，但任何系统都不能绕过同意、撤回、职责分离或擅自改写其他系统。

## 2. 数据与隐私边界

- 邮箱、手机、设备标识和外部联系人键只在调用端短暂使用；本应用只接受并保存64位不可逆 SHA-256/HMAC 类摘要和不具识别能力的短提示。
- 每条信号必须绑定状态为 `active` 且未过期的同意记录，并固定同意事件的修订号与 `source_event_hash`。
- 同意撤回或过期后，既有证据保留用于审计，但禁止继续核验、匹配或发布。
- 概率匹配只能形成待裁决建议，不能自动合并；裁决者必须不同于提议者。
- 下游只接收不可变黄金档案版本，本应用不直接改写 CDP、CRM、广告或服务系统。

共享契约：

```text
raw_identifier_stored = false
consent_required = true
revoked_consent_matchable = false
source_revision_pinned = true
source_fingerprint_pinned = true
signal_self_verification = false
match_self_approval = false
probabilistic_auto_merge = false
profile_author_self_publish = false
published_versions_mutable = false
consumer_system_mutated = false
acknowledgement_required = true
```

## 3. 状态机与职责分离

- 同意：`pending → active → revoked`
- 身份信号：`pending → verified`
- 匹配案件：`proposed → approved / rejected`
- 黄金档案：`draft → published`
- 下游交付：`pending → acknowledged`

禁止申请人自批同意、采集人自核验信号、提议人自裁决匹配、档案作者自发布、发布人自确认下游回执。修订冲突、来源指纹漂移、撤回/过期同意、明文标识或变化后的版本均必须阻断。

## 4. 权限与审计

- `factory.portrait.identity.consent.manage`
- `factory.portrait.identity.consent.approve`
- `factory.portrait.identity.signal.manage`
- `factory.portrait.identity.signal.verify`
- `factory.portrait.identity.match.propose`
- `factory.portrait.identity.match.decide`
- `factory.portrait.identity.profile.publish`
- `factory.portrait.identity.handoff.acknowledge`

每个写操作在路由层执行项目权限检查并写审计；七张领域表均携带 `project_id`、`agent_path`、`tenant_id`、`client_id`、`plan_id`，查询必须以项目隔离。

## 5. 运营指标与验收

- 有效同意数与撤回执行时效
- 已独立核验的身份信号数
- 已批准匹配覆盖率与冲突拒绝率
- 已发布黄金档案数与不可变版本哈希
- CDP、CRM、广告、服务四类下游回执率

完成条件：原始标识入库数为零；三类以上哈希信号全部异人核验；匹配理由、评分和信号清单可重算；黄金档案来源清单哈希一致；四类下游全部确认；同意撤回后新匹配立即失败；跨项目查询返回空；业务证据与平台审计齐全。

## 6. 迁移与回滚

迁移：`2c6e9a4b1d83`，上游：`1b5d8f3a0c72`。

回滚前导出同意引用、信号哈希、匹配裁决、黄金档案版本哈希和下游回执。回滚只删除身份合并投影、证据和新增权限，绝不删除或修改 CRM、CDP、法务主体、联系人、账户、设备、邮箱、手机或下游系统记录。

## 7. 开发与验收顺序

1. Alembic upgrade / downgrade / upgrade。
2. 专属服务测试：明文拦截、职责分离、来源漂移、撤回阻断、租户隔离。
3. 完整工厂测试、平台布局与租户上下文检查。
4. TypeScript、平台蓝图、15道开发门禁与生产构建。
5. 总部、数据管家、下游三类身份完成真实 API 闭环。
6. 数据库检查原始标识未入库、哈希可重算、来源未变、证据和审计齐全。
7. 真实页面核对指标、导航、面包屑与横向溢出。
