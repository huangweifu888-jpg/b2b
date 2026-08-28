# ICP客户定位运行契约

## 1. 业务目标与客户买点

ICP客户定位不是另一份客户名单，而是把“我们应该把预算、内容和销售时间投向谁”变成全平台可复核、可发布、可追责的统一标准。工厂客户购买它的核心价值是：营销不再凭感觉买流量，销售不再各自定义好客户，管理层能够用真实报价、订单、装机和客户反馈证明目标客群是否值得持续投入。

它与普通CRM标签或广告人群包的差异在于：定义有不可变版本，账户判断有权威业务证据，评分逐项可解释，启用与验证职责分离，下游系统必须显式确认接收。CRM仍是客户主档权威源，ICP只发布定位契约，不抢占客户、产品或订单的记录权。

## 2. 权威来源与数据边界

首批允许引用四类事实：CPQ报价、OMS履约订单、已安装客户资产、VOC客户之声。每条账户证据固定来源ID、业务编号、状态和修订号；来源修订变化后，验证和评分立即阻断，必须重新采集。

系统绝不修改 CPQ、OMS、客户资产或VOC记录，也不写回CRM客户主档。人工补充国家、行业和企业规模时必须提供外部证据引用；不保存原始个人联系人、邮箱、电话、证件或第三方登录凭据。

关键契约：

```text
account_system_of_record = false
product_system_of_record = false
raw_personal_contact_data_stored = false
source_revision_pinned = true
manual_firmographics_require_evidence = true
fit_score_explainable = true
ai_autonomous_qualification = false
author_self_approval = false
assessor_self_verification = false
activation_mutates_consumer = false
activation_acknowledgement_required = true
```

## 3. 状态机与职责分离

ICP档案：`draft → active → retired`。草稿必须至少包含经济决策人、技术决策人、业务推动者三种采购角色和两个购买场景，作者不能批准自己的档案；退役保留全部历史版本、证据、评分和激活记录。

账户证据：`pending → verified`。采集者不能验证自己的证据，验证前重新检查来源修订。

匹配评分：`pending → verified`。评分固定ICP版本哈希和账户证据版本，输出国家、行业、规模、产品、角色、触发事件和潜在价值七项分数与解释；评分者不能复核自己的结果。

下游激活：`pending → acknowledged`。只向线索路由、ABM、内容个性化和销售打法发布不可变契约，不直接修改消费者数据；发布者不能代替消费者确认。

## 4. 核心数据对象

- `FactoryIcpProfile`：稳定ICP身份、市场模式、客户类型和生命周期。
- `FactoryIcpVersion`：不可变地域、行业、规模、产品、角色、触发条件、门槛、权重和定义哈希。
- `FactoryIcpBuyingRole`：采购委员会角色、痛点、证据要求和触达渠道。
- `FactoryIcpScenario`：购买任务、触发事件、产品范围、成功结果和淘汰条件。
- `FactoryIcpAccountEvidence`：权威业务来源快照及有引用的企业特征。
- `FactoryIcpFitAssessment`：逐项可解释分数、等级、版本针脚和独立复核。
- `FactoryIcpActivation`：下游消费者、最低等级、交付引用和确认事实。
- `FactoryIcpEvidence`：追加式审计证据链。

每个对象都携带 `project_id / agent_path / tenant_id / client_id / plan_id`，所有读写受项目访问与细粒度权限约束。

## 5. 权限

```text
factory.identity.icp.profile.manage
factory.identity.icp.profile.approve
factory.identity.icp.evidence.capture
factory.identity.icp.evidence.verify
factory.identity.icp.fit.assess
factory.identity.icp.fit.verify
factory.identity.icp.activation.manage
factory.identity.icp.activation.acknowledge
```

## 6. 经营指标

- 启用ICP数与采购角色覆盖数。
- 已评估账户数与A/B级高匹配率。
- 权威证据独立验证覆盖率。
- 下游激活确认率。
- 因来源修订漂移而阻断的重采集数量。
- ICP账户进入询盘、报价、成交及续费后的分层转化率；该跨域指标只在指标中心按已发布事实计算。

## 7. API与真实页面

API前缀：`/api/v1/factory-platform/projects/{project_id}/icp-profiles`。真实页面：`/zb/client-source/icp-profiles`。页面覆盖完整档案草稿、角色和场景、异人启用、来源采集、异人验证、可解释评分、异人复核、下游发布与确认。

## 8. 迁移、回滚与验收

Alembic修订 `d5b17e3f6ac4`，父修订 `c4a06d2e5fb3`。回滚只删除ICP八张表和八项权限，不删除或修改报价、订单、装机资产、客户之声、CRM或消费者记录。生产回滚前导出启用版本和已确认激活载荷。

验收至少证明：三身份职责分离；来源修订漂移会阻断；七项权重合计100；评分解释和定义哈希可追溯；来源记录零修改；其他项目不可见；页面无横向溢出；迁移可升降级；后端测试、TypeScript、平台蓝图契约和生产构建全部通过。
