# 02.布场｜首页与落地页设计器运营契约

## 商业闭环

`页面组合主档 -> 导航/Banner/推荐组合固化 -> 独立校验 -> 受控交接 -> 独立批准 -> 下游回执`。

页面组合是内容设计版本，不是客户网站的直接控制权。每条记录绑定 `agent_path`、`tenant_id`、`client_id`、`plan_id` 和 `project_id`；它只消费编辑器明确提交的组合，不覆盖客户站点、页面锁定或插件锁定。

## 强制边界

`/company-info?tab=navigation` 保留原有可视化导航编辑器；受控发布面板只读取当前导航、Banner、推荐组合并创建可追溯版本。它不执行发布、删除或覆盖站点页面，不写回本地编辑器，也不允许凭据、`javascript:` 链接或 `<script>` 标记进入组合清单。

作者不能校验自己的组合；准备交接者不能批准；批准者不能登记自己的下游回执。冻结对象契约为 `homepage-composition-version`，事件契约为 `homepage-composition-released`。

## 可运营证据门槛

`content.homepage` 保持 `pilot`，直至受控模型、项目权限与审计、冻结对象/事件契约、迁移和回滚、自动测试、三身份 API、共享客户源页面、生产构建及实际页面验收全部通过。验收命令为 `tools/run_homepage_design_api_acceptance.ps1`；回滚仅移除本应用的治理投影、权限和契约，绝不影响客户页面、草稿或锁定配置。

2026-08-06：迁移 `3e8a1c5d7f92` 已完成升级、回滚和再次升级演练；总部、代理、客户三身份 API 得到 `available` 的消费者回执；导航自定义页面的共享客户源验收得到 live、三条治理记录、六个动作且无横向溢出。因此 `content.homepage` 已明确提升为 `available`。
