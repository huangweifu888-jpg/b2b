# 社交聆听运行契约

社交聆听将已核验的公开品牌、竞品、需求或问题提及，转为可追溯的内部处置任务。它不是私信抓取器、账号授权库或自动回复工具；只接收已存在的公开信誉评估，不保存社交账号密码、OAuth 令牌或私信内容。

## 生命周期与权限

先由具备 `factory.deepen.listening.capture` 的项目成员从已核验公开信誉评估创建信号，并固定来源评估、公开链接、渠道、情绪和指纹。独立成员以 `factory.deepen.listening.verify` 核验；第三名独立成员以 `factory.deepen.listening.route` 把信号交给营销、销售或服务负责人；非路由人使用 `factory.deepen.listening.acknowledge` 确认接收。每一步都带乐观锁版本与审计事件，跨租户或跨项目无法访问。

## 三端共享边界

总部端制定信号分类和优先级，代理端承担独立核验，客户项目端决定业务分流并确认接收。三端共享的是公开来源、指纹、状态和交接单；系统明确承诺 `private_messages_collected=false`、`automatic_public_reply=false` 与 `external_social_action_dispatched=false`。因此页面不会把内部交接伪装成已在外部社交平台行动。

## 迁移与回滚

迁移 `e1c7a4d9b806` 新增社交聆听信号与交接单、四项项目权限及对象/事件契约。回滚只移除本应用投影与这四项权限、契约，不删除既有公开信誉评估、审计记录或任何外部平台数据。
