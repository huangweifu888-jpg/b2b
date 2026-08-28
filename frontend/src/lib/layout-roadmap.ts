export type LayoutRoadmapStatus = "completed" | "active" | "planned";

export type LayoutRoadmapItem = {
  id: number;
  phase: "稳定基础" | "统一应用" | "安全同步" | "长期效率";
  title: string;
  focus: string;
  status: LayoutRoadmapStatus;
};

const completed = (id: number, title: string, focus: string): LayoutRoadmapItem => ({ id, phase: "稳定基础", title, focus, status: "completed" });
const active = (id: number, title: string, focus: string): LayoutRoadmapItem => ({ id, phase: "稳定基础", title, focus, status: "active" });
const planned = (id: number, phase: LayoutRoadmapItem["phase"], title: string, focus: string): LayoutRoadmapItem => ({ id, phase, title, focus, status: "planned" });

/**
 * The single, reviewable execution order for the Layout Developer.  A step
 * can be learned only after its build gate has passed; this list itself never
 * writes page content or downstream tenant overrides.
 */
export const LAYOUT_ROADMAP: readonly LayoutRoadmapItem[] = [
  completed(1, "页面框架基线", "首页大图、普通业务页与产品市场外框契约"),
  completed(2, "沙盘异常隔离", "右侧沙盘错误边界与重试入口"),
  completed(3, "本地环境恢复", "异常提醒、重启提示与可恢复检查"),
  completed(4, "自动续跑清理", "移除旧续跑入口并记录稳定性规则"),
  completed(5, "生命周期清理", "定时器、监听器与弹窗卸载契约"),
  completed(6, "质量基线页面", "六个真实页面的构建验收路由"),
  completed(7, "页面级错误边界", "单页失败不再影响客户端壳层"),
  completed(8, "弹窗样式隔离", "内容设计工作台与结果窗口分离"),
  completed(9, "旧框架治理", "收口旧选择器、重复外框与跨窗口样式耦合"),
  completed(10, "页面框架合同", "主体、标题、表头、内容、尾栏与滚条归属"),
  completed(11, "主题令牌校验", "色板、字体、间距和圆角只由共享变量输出"),
  completed(12, "组件清理报告", "页面清扫器输出旧类名和覆盖来源"),
  completed(13, "可访问性基线", "焦点、提示、对比度与键盘操作"),
  completed(14, "性能基线", "重型预览延迟加载与列表虚拟化检查"),
  completed(15, "基础回归集", "首页大图作为稳定基础阶段验收页"),
  completed(16, "共享变量归属", "顶部、主体、标题、滚条、尾栏的唯一来源",),
  completed(17, "内容设计归属", "表头、卡片、列表和页面内容只在内容设计维护"),
  completed(18, "插件中心注册表", "插件名称、图标、动作、提示和适用位置统一注册"),
  completed(19, "方案规划归属", "可复用方案只保存结构组合，不保存业务数据"),
  completed(20, "质量中心归属", "学习记录只接收已确认且构建通过的结果"),
  completed(21, "页面配置合同", "新页面声明框架、内容、插件和锁定范围"),
  completed(22, "主题预览一致性", "色板悬停与实际页面同源渲染"),
  completed(23, "表头组合合同", "多表头选择按换行组合，不左右挤压"),
  completed(24, "内容组合合同", "多内容设计组合在同一页面按区块呈现"),
  completed(25, "插件动作合同", "拖拉、上移下移、图标、状态、删除等统一样式"),
  completed(26, "锁定继承合同", "一级只选中，二级才锁定，新增页面自动登记"),
  completed(27, "导航同步合同", "栏目配置、左侧导航、页面锁定同一数据源"),
  completed(28, "框架样式合同", "右侧栏、主体外框、标题边距和滚条统一来源"),
  completed(29, "版本学习合同", "版本记录附带变更说明、验证结果与恢复点"),
  completed(30, "统一应用验收", "六个基线页面与产品市场四页共同验收"),
  completed(31, "当页试运行", "先在当前页预览差异，不写入正式配置"),
  completed(32, "全局试运行", "列出受影响框架令牌与页面数量"),
  completed(33, "差异确认", "按主体、标题、表头、内容、尾栏显示变更"),
  completed(34, "恢复点", "全局和当页应用前均生成可恢复快照"),
  completed(35, "同步报告", "记录来源、范围、跳过项和验证结论"),
  completed(36, "下游保护", "模板源可下发，下游自定义与新增数据不被覆盖"),
  completed(37, "锁定页面策略", "锁定仅限制结构写入，不阻断共享主题读取"),
  completed(38, "冲突提示", "页面局部覆盖与共享令牌冲突时提示来源"),
  completed(39, "批量操作预览", "开通、取消、隐藏先展示目标和结果"),
  completed(40, "同步后回归", "同步后自动检查首屏、滚条、尾栏和关键操作"),
  completed(41, "恢复后回归", "恢复快照后检查版本、令牌和页面结构"),
  completed(42, "内容安全同步", "方案和插件仅更新结构元数据，不覆盖业务内容"),
  completed(43, "发布前检查", "把构建、错误边界和页面合同汇总为发布门禁"),
  completed(44, "安全同步验收", "首页大图与域名注册作为同步演练页"),
  completed(45, "同步审计归档", "保存最近有效报告并清理过期草稿"),
  completed(46, "截图回归", "首页大图已完成主体、标题、表头、内容、滚条与尾栏的可视回归核对"),
  completed(47, "健康评分", "质量中心汇总共享框架、页面合同、回归基线与确认学习的只读评分"),
  completed(48, "新增页面向导", "按页面路径自动给出共享框架、表头、内容形态与插件位置的只读建议"),
  completed(49, "新增插件向导", "注册图标、动作、提示、预览位置和无障碍文本"),
  completed(50, "规则建议", "根据重复差异提出共享变量或内容设计归属建议"),
  completed(51, "配置去重", "发现等价局部配置后建议收敛到全局令牌"),
  completed(52, "样式覆盖诊断", "显示最终生效选择器及其来源"),
  completed(53, "性能趋势", "记录工作台打开、预览和页面切换耗时"),
  completed(54, "异常知识库", "页面清扫器沉淀沙盘和本地环境异常的修复规则"),
  completed(55, "质量仪表盘", "按阶段、页面、插件和主题显示健康状态"),
  completed(56, "回归样本扩展", "把新页面纳入质量中心基线队列"),
  completed(57, "迁移助手", "旧页面迁移到页面合同前先给出只读诊断"),
  completed(58, "可维护性检查", "限制跨页面选择器和重复固定值"),
  completed(59, "全链路演练", "从新增页面到同步、恢复和回归的完整演练"),
  completed(60, "长期效率验收", "形成可重复的新增、验证、同步和恢复闭环"),
] as const;

export const LAYOUT_ROADMAP_TOTAL = LAYOUT_ROADMAP.length;
