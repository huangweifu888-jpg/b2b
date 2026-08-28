# 03.营搜｜页面 SEO 助手运营契约

`trust.onpage` 以 `页面与来源引用 → 不可变建议版本 → 异人复核 → 可回退交接 → 异人批准 → 内容负责人回执` 管理 TDK、内链和内容质量建议。所有记录绑定 `agent_path`、`tenant_id`、`client_id`、`plan_id` 与 `project_id`；建议不能绕过内容审核，也不承诺排名。

## 受控交付链

总部记录页面和来源版本，代理仅在授权范围内独立复核/批准，客户内容负责人、SEO 或站点编辑端以回执接收交接。建议是受控编辑输入，不会自动发布页面、Meta、内链或结构化内容。

## 数据、权限与回退

迁移 `9e7a3c2d1b86` 建立页面、建议版本、发布和证据投影，冻结对象 `onpage-seo-suggestion-version` 与事件 `onpage-seo-handoff-released`。回滚只移除本应用投影、权限和契约，绝不删除来源页面、内容、CMS 设置或消费者工作。

## 可用性证据

`/seo?tab=meta` 保留原 Meta 编辑器，只增加共享治理面板。升格为 `available` 前必须通过 `test_factory_onpage_seo.py`、升级→回滚→再升级演练、总部/代理/客户真实 API 回执、页面 `live` 状态、六步动作、无横向溢出、生产构建和 H 版本同步。
