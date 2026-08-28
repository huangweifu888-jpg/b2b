# 投放实验运行契约

“投放实验中心”把素材、受众、落地页或报价组合的业务假设，转换为可审计的实验结论工作单。它不接入、更不复制广告平台原始数据；广告平台和数据源仍是相关数据的唯一记录。

## 生命周期与权限

实验按 `draft → reviewed → decided` 流转，结论接收按 `pending → acknowledged` 流转。创建、独立复核、独立决策和接收分别需要 `factory.lead.experiments.create`、`.review`、`.decide`、`.acknowledge`。创建人不能复核自己的实验；创建人与复核人不能作出决策；决策人不能确认自己的结论。项目权限、乐观锁和审计事件共同阻止越权与并发覆盖。

## 三端可视化共享边界

总部端登记实验假设及证据引用；代理源端独立复核；客户项目端作出营销结论；再由另一授权端接收结论。三端共享实验编号、假设、证据引用、状态、结论去向和不可变指纹，不共享任何原始广告数据。共享契约固定 `raw_campaign_data_copied=false`、`external_campaign_changed=false`、`incrementality_guaranteed=false`：系统不自动改动外部广告账户、预算或投放，也不把相关性表述为增量承诺。

## 迁移与回滚

迁移 `d2f7a9c5e308` 新增 `factory_marketing_experiments` 与 `factory_experiment_decisions`，写入四项项目权限和 `marketing-experiment` / `experiment-decision-routed` 对象事件契约。回滚仅删除本迁移的实验投影、权限和契约；不会删除审计日志、既有营销内容、外部广告账户或外部平台数据。
