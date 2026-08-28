/**
 * One reusable specification schema for every operating module.  Instances
 * own their wording and evidence; the template owns the fields and release
 * boundary only.
 */
export const DEVELOPMENT_STANDARD_TEMPLATE = {
  id: "development-standard-v1",
  version: "1.0.0",
  title: "统一开发规范模板",
  fields: [
    "规范编号",
    "规范名称",
    "适用模块",
    "适用端口",
    "业务目的",
    "使用角色",
    "前置条件",
    "执行步骤",
    "操作入口",
    "验收标准",
    "验证证据",
    "风险说明",
    "当前状态",
    "模板版本",
  ],
  releaseBoundary: "A 总部端 → 代理源端 → 代理端；B 总部端 → 客户源端 → 客户计划／站点。总部端不得绕过来源端直达运行实例；代理源端与客户源端互不发布；任何分支均不得反向发布；不覆盖下游账号、素材、内容、线索和经营数据。",
} as const;
