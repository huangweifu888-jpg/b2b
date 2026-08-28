# 02.布场｜案例、新闻与视频运营契约

## 授权内容闭环与边界

`content.proof` 统一治理工程案例、新闻、企业视频与博客：`来源和授权范围 → 内容资产 → 固定版本 → 独立核验 → 受控交接 → 独立批准 → 下游回执`。每条记录绑定 `agent_path`、`tenant_id`、`client_id`、`plan_id` 与 `project_id`。

它只保存内容版本、来源引用、授权引用和公开范围，不直接改写原内容编辑器、来源文件、客户隐私数据或消费者网站；缺少客户授权、来源或适用范围的材料不能进入正式发布。对象契约为 `authorized-proof-content-version`，事件契约为 `authorized-proof-content-released`。

迁移 `6b4e1d9a2f70` 创建四张租户投影及四项权限：`factory.content.proof.asset.manage`、`factory.content.proof.version.verify`、`factory.content.proof.publication.approve`、`factory.content.proof.handoff.acknowledge`。回滚只移除治理投影、权限和契约，不删除原编辑器内容、授权文件或消费者副本。三身份 API 验收命令：`tools/run_content_proof_api_acceptance.ps1`。

2026-08-06：迁移已完成升级、回滚和再升级演练；总部、代理、客户三身份取得 `available` 回执，并证明 `source_content_mutated_directly=false`、`authorization_bypassed=false`、`customer_personal_data_stored=false`。`/cases?tab=list` 共享客户源页面得到 `live`、三条治理记录、授权输入区、六个生命周期动作且无横向溢出。因此 `content.proof` 已提升为 `available`。
