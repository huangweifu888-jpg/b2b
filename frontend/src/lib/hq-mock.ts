// HQ admin mock data - platform-level
export const hqKpis = {
  totalAgencies: 68,
  totalEnterprises: 1240,
  totalSites: 3850,
  mrr: 4260000,
  arpu: 3435,
  aiCostMonth: 186000,
  aiCallsToday: 248600,
  pendingAudit: 14,
};

export const hqTrend = [
  { m: "2025-11", mrr: 2860000, agencies: 48, users: 8200, aiCost: 96000 },
  { m: "2025-12", mrr: 3180000, agencies: 52, users: 9400, aiCost: 112000 },
  { m: "2026-01", mrr: 3420000, agencies: 56, users: 10800, aiCost: 128000 },
  { m: "2026-02", mrr: 3680000, agencies: 60, users: 12100, aiCost: 142000 },
  { m: "2026-03", mrr: 3920000, agencies: 64, users: 13500, aiCost: 168000 },
  { m: "2026-04", mrr: 4260000, agencies: 68, users: 14800, aiCost: 186000 },
];

export const hqMembers = [
  { id: "HQ001", name: "王总", email: "wang@hq.com", role: "超级管理员", dept: "总经办", lastLogin: "刚刚", status: "active" },
  { id: "HQ002", name: "李运营", email: "li@hq.com", role: "运营总监", dept: "运营部", lastLogin: "5 分钟前", status: "active" },
  { id: "HQ003", name: "张财务", email: "zhang@hq.com", role: "财务主管", dept: "财务部", lastLogin: "2 小时前", status: "active" },
  { id: "HQ004", name: "陈技术", email: "chen@hq.com", role: "技术总监", dept: "技术部", lastLogin: "昨日", status: "active" },
  { id: "HQ005", name: "赵客服", email: "zhao@hq.com", role: "客服主管", dept: "客服部", lastLogin: "3 天前", status: "active" },
  { id: "HQ006", name: "刘审核", email: "liu@hq.com", role: "审核员", dept: "风控部", lastLogin: "1 小时前", status: "active" },
  { id: "HQ007", name: "孙市场", email: "sun@hq.com", role: "市场经理", dept: "市场部", lastLogin: "30 分钟前", status: "active" },
  { id: "HQ008", name: "周产品", email: "zhou@hq.com", role: "产品经理", dept: "产品部", lastLogin: "2 天前", status: "disabled" },
];

export const hqRoles = [
  { id: "HR01", name: "超级管理员", members: 2, permissions: 128, desc: "拥有所有权限" },
  { id: "HR02", name: "运营总监", members: 3, permissions: 86, desc: "代理商、套餐、活动管理" },
  { id: "HR03", name: "财务主管", members: 2, permissions: 42, desc: "订单、资金、发票" },
  { id: "HR04", name: "技术总监", members: 1, permissions: 65, desc: "AI 服务、平台配置、告警" },
  { id: "HR05", name: "客服主管", members: 4, permissions: 38, desc: "工单、满意度、通知" },
  { id: "HR06", name: "审核员", members: 6, permissions: 18, desc: "充值、OEM、订单审核" },
  { id: "HR07", name: "只读观察员", members: 3, permissions: 24, desc: "仅查看数据" },
];

export const hqDepts = [
  { id: "D01", name: "总经办", manager: "王总", members: 3, children: ["董事会", "战略部"] },
  { id: "D02", name: "运营部", manager: "李运营", members: 12, children: ["代理商运营", "企业运营", "内容运营"] },
  { id: "D03", name: "财务部", manager: "张财务", members: 6, children: ["应收", "应付", "税务"] },
  { id: "D04", name: "技术部", manager: "陈技术", members: 28, children: ["后端", "前端", "AI", "运维"] },
  { id: "D05", name: "客服部", manager: "赵客服", members: 18, children: ["一线", "投诉处理"] },
  { id: "D06", name: "风控部", manager: "刘审核", members: 8, children: ["订单审核", "反欺诈"] },
  { id: "D07", name: "市场部", manager: "孙市场", members: 10, children: ["品牌", "SEM", "渠道"] },
  { id: "D08", name: "产品部", manager: "周产品", members: 15, children: ["客户端", "代理商端", "总部端"] },
];

export const agencies = [
  { id: "A001", name: "深圳星辰代理", owner: "张星辰", enterprises: 48, sites: 126, mrr: 285600, level: "白金", joined: "2023-03-15", status: "active" },
  { id: "A002", name: "广州优贸 OEM", owner: "李优贸", enterprises: 36, sites: 92, mrr: 198000, level: "黄金", joined: "2023-06-20", status: "active" },
  { id: "A003", name: "上海华商网络", owner: "王华商", enterprises: 62, sites: 186, mrr: 362000, level: "白金", joined: "2023-01-08", status: "active" },
  { id: "A004", name: "杭州速建", owner: "陈速建", enterprises: 28, sites: 78, mrr: 142000, level: "黄金", joined: "2024-02-12", status: "active" },
  { id: "A005", name: "义乌全球通", owner: "刘全球", enterprises: 85, sites: 268, mrr: 486000, level: "钻石", joined: "2022-09-30", status: "active" },
  { id: "A006", name: "东莞智造站", owner: "赵智造", enterprises: 22, sites: 56, mrr: 98000, level: "白银", joined: "2024-08-05", status: "active" },
  { id: "A007", name: "宁波港贸", owner: "孙港贸", enterprises: 18, sites: 42, mrr: 82000, level: "白银", joined: "2025-01-18", status: "trial" },
  { id: "A008", name: "厦门国贸联", owner: "周国贸", enterprises: 34, sites: 88, mrr: 168000, level: "黄金", joined: "2023-11-22", status: "paused" },
];

export const rechargeAudits = [
  { id: "RA2001", agency: "深圳星辰代理", amount: 200000, method: "对公转账", voucher: "bank_receipt_001.pdf", submitted: "2026-04-27 10:32", status: "pending" },
  { id: "RA2002", agency: "广州优贸 OEM", amount: 100000, method: "对公转账", voucher: "bank_receipt_002.pdf", submitted: "2026-04-26 16:45", status: "pending" },
  { id: "RA2003", agency: "上海华商网络", amount: 500000, method: "对公转账", voucher: "bank_receipt_003.pdf", submitted: "2026-04-26 09:18", status: "approved" },
  { id: "RA2004", agency: "义乌全球通", amount: 300000, method: "支付宝", voucher: "-", submitted: "2026-04-25 14:22", status: "approved" },
  { id: "RA2005", agency: "杭州速建", amount: 80000, method: "对公转账", voucher: "bank_receipt_005.pdf", submitted: "2026-04-24 11:05", status: "rejected" },
];

export const oemAudits = [
  { id: "OA3001", agency: "深圳星辰代理", brand: "StarTrade Pro", domain: "agency.startrade.com", logo: "✓", submitted: "2026-04-26", status: "pending" },
  { id: "OA3002", agency: "广州优贸 OEM", brand: "YouMao Global", domain: "admin.youmao.cn", logo: "✓", submitted: "2026-04-25", status: "pending" },
  { id: "OA3003", agency: "上海华商网络", brand: "HuaShang Cloud", domain: "platform.huashang.com", logo: "✓", submitted: "2026-04-20", status: "approved" },
  { id: "OA3004", agency: "义乌全球通", brand: "YiwuGo SaaS", domain: "saas.yiwugo.com", logo: "✓", submitted: "2026-04-15", status: "approved" },
];

export const hqEnterprises = [
  { id: "E10001", name: "深圳市启明光电有限公司", agency: "深圳星辰代理", industry: "LED 照明", sites: 3, plan: "企业版", mrr: 12800, joined: "2024-03-15", status: "active" },
  { id: "E10002", name: "宁波华达机械制造", agency: "深圳星辰代理", industry: "机械设备", sites: 2, plan: "专业版", mrr: 6800, joined: "2024-05-22", status: "active" },
  { id: "E10003", name: "广州美妆优品股份", agency: "广州优贸 OEM", industry: "美妆个护", sites: 5, plan: "旗舰版", mrr: 15800, joined: "2023-11-08", status: "active" },
  { id: "E10004", name: "青岛海兴渔业出口", agency: "上海华商网络", industry: "食品饮料", sites: 1, plan: "基础版", mrr: 680, joined: "2026-04-01", status: "trial" },
  { id: "E10005", name: "义乌小商品外贸通", agency: "义乌全球通", industry: "综合贸易", sites: 6, plan: "旗舰版", mrr: 18600, joined: "2023-06-14", status: "active" },
  { id: "E10006", name: "东莞赛福电子科技", agency: "东莞智造站", industry: "消费电子", sites: 4, plan: "企业版", mrr: 12400, joined: "2024-01-10", status: "active" },
];

export const hqSites = [
  { id: "S50001", domain: "lumitech-global.com", enterprise: "启明光电", agency: "深圳星辰代理", traffic: 28400, storage: 1.2, bandwidth: 86, status: "online", ssl: "✓" },
  { id: "S50002", domain: "huada-machine.com", enterprise: "华达机械", agency: "深圳星辰代理", traffic: 12800, storage: 0.8, bandwidth: 42, status: "online", ssl: "✓" },
  { id: "S50003", domain: "meizhuang-beauty.com", enterprise: "美妆优品", agency: "广州优贸 OEM", traffic: 45600, storage: 3.5, bandwidth: 186, status: "online", ssl: "✓" },
  { id: "S50004", domain: "yiwu-go.com", enterprise: "义乌小商品", agency: "义乌全球通", traffic: 56700, storage: 5.2, bandwidth: 268, status: "online", ssl: "✓" },
  { id: "S50005", domain: "saifu-tech.com", enterprise: "赛福电子", agency: "东莞智造站", traffic: 32100, storage: 2.1, bandwidth: 124, status: "online", ssl: "✓" },
  { id: "S50006", domain: "haixing-export.com", enterprise: "海兴渔业", agency: "上海华商网络", traffic: 6200, storage: 0.4, bandwidth: 18, status: "building", ssl: "-" },
];

export const domains = [
  { domain: "lumitech-global.com", type: "主域名", site: "启明光电", sslExpires: "2026-12-30", status: "active", renew: "auto" },
  { domain: "huada-machine.com", type: "主域名", site: "华达机械", sslExpires: "2026-08-15", status: "active", renew: "auto" },
  { domain: "meizhuang-beauty.com", type: "主域名", site: "美妆优品", sslExpires: "2026-05-10", status: "expiring", renew: "manual" },
  { domain: "www.lumitech-global.com", type: "子域名", site: "启明光电", sslExpires: "2026-12-30", status: "active", renew: "auto" },
  { domain: "es.meizhuang-beauty.com", type: "子域名", site: "美妆优品", sslExpires: "2026-05-10", status: "expiring", renew: "manual" },
  { domain: "saifu-tech.com", type: "主域名", site: "赛福电子", sslExpires: "2027-02-20", status: "active", renew: "auto" },
];

export const templates = [
  { id: "TPL01", name: "Industrial Pro", category: "工业机械", thumbnail: "🏭", uses: 186, rating: 4.8, status: "published" },
  { id: "TPL02", name: "Beauty Elegance", category: "美妆个护", thumbnail: "💄", uses: 248, rating: 4.9, status: "published" },
  { id: "TPL03", name: "Tech Modern", category: "消费电子", thumbnail: "📱", uses: 312, rating: 4.7, status: "published" },
  { id: "TPL04", name: "Food Fresh", category: "食品饮料", thumbnail: "🥬", uses: 98, rating: 4.6, status: "published" },
  { id: "TPL05", name: "Fashion Lux", category: "服装纺织", thumbnail: "👗", uses: 156, rating: 4.7, status: "published" },
  { id: "TPL06", name: "Factory Plus", category: "工业机械", thumbnail: "⚙️", uses: 142, rating: 4.5, status: "published" },
  { id: "TPL07", name: "Artisan Craft", category: "工艺礼品", thumbnail: "🎨", uses: 68, rating: 4.6, status: "published" },
  { id: "TPL08", name: "Marketplace Mega", category: "综合贸易", thumbnail: "🛒", uses: 86, rating: 4.4, status: "draft" },
];

export const gallery = [
  { id: "IMG01", name: "hero-factory", category: "工业", size: "1920×1080", weight: "186 KB", uses: 248, uploaded: "2026-04-10" },
  { id: "IMG02", name: "hero-beauty", category: "美妆", size: "1920×1080", weight: "224 KB", uses: 312, uploaded: "2026-04-08" },
  { id: "IMG03", name: "product-led", category: "产品", size: "800×800", weight: "86 KB", uses: 186, uploaded: "2026-04-05" },
  { id: "IMG04", name: "bg-pattern", category: "背景", size: "1920×1920", weight: "64 KB", uses: 520, uploaded: "2026-03-28" },
  { id: "IMG05", name: "icon-set-1", category: "图标", size: "512×512", weight: "42 KB", uses: 680, uploaded: "2026-03-20" },
  { id: "IMG06", name: "hero-electronics", category: "消费电子", size: "1920×1080", weight: "212 KB", uses: 98, uploaded: "2026-04-15" },
];

export const aiVendors = [
  { id: "V01", name: "OpenAI", logo: "🟢", status: "active", models: 6, monthlyCost: 62400, quotaUsed: 68, region: "US-East" },
  { id: "V02", name: "Google Gemini", logo: "🔵", status: "active", models: 4, monthlyCost: 48200, quotaUsed: 54, region: "Asia-SE" },
  { id: "V03", name: "Anthropic Claude", logo: "🟠", status: "active", models: 3, monthlyCost: 38600, quotaUsed: 42, region: "US-West" },
  { id: "V04", name: "DeepSeek", logo: "🟣", status: "active", models: 2, monthlyCost: 8800, quotaUsed: 18, region: "CN" },
  { id: "V05", name: "Qwen", logo: "🟡", status: "active", models: 3, monthlyCost: 12600, quotaUsed: 24, region: "CN" },
  { id: "V06", name: "ElevenLabs", logo: "⚫", status: "paused", models: 2, monthlyCost: 15400, quotaUsed: 0, region: "US" },
];

export const aiModels = [
  { id: "M01", vendor: "OpenAI", name: "gpt-5.4", type: "文本", inputPrice: 3, outputPrice: 15, calls: 68400, cost: 28600, status: "active" },
  { id: "M02", vendor: "OpenAI", name: "gpt-5.4-mini", type: "文本", inputPrice: 0.3, outputPrice: 1.2, calls: 186000, cost: 12800, status: "active" },
  { id: "M03", vendor: "Google", name: "gemini-2.5-pro", type: "文本/多模态", inputPrice: 1.25, outputPrice: 5, calls: 128000, cost: 18400, status: "active" },
  { id: "M04", vendor: "Google", name: "gemini-3-pro-image", type: "图像生成", inputPrice: 40, outputPrice: 0, calls: 8600, cost: 12800, status: "active" },
  { id: "M05", vendor: "Anthropic", name: "claude-opus-4.6", type: "文本", inputPrice: 15, outputPrice: 75, calls: 12400, cost: 22400, status: "active" },
  { id: "M06", vendor: "DeepSeek", name: "deepseek-v3.2", type: "文本", inputPrice: 0.14, outputPrice: 0.28, calls: 486000, cost: 8800, status: "active" },
  { id: "M07", vendor: "Google", name: "veo-3.1-generate", type: "视频生成", inputPrice: 0, outputPrice: 500, calls: 420, cost: 8400, status: "active" },
  { id: "M08", vendor: "ElevenLabs", name: "eleven_v3", type: "音频合成", inputPrice: 0.18, outputPrice: 0, calls: 0, cost: 0, status: "paused" },
];

export const aiKeys = [
  { id: "K01", vendor: "OpenAI", alias: "prod-main", maskedKey: "sk-****...Z4H8", env: "生产", usage: "62%", expires: "-", status: "active" },
  { id: "K02", vendor: "OpenAI", alias: "prod-backup", maskedKey: "sk-****...A2K1", env: "生产", usage: "18%", expires: "-", status: "active" },
  { id: "K03", vendor: "Google", alias: "prod-gemini", maskedKey: "AIza****...9X", env: "生产", usage: "54%", expires: "-", status: "active" },
  { id: "K04", vendor: "Anthropic", alias: "prod-claude", maskedKey: "sk-ant-****...P3", env: "生产", usage: "42%", expires: "-", status: "active" },
  { id: "K05", vendor: "DeepSeek", alias: "prod-ds", maskedKey: "sk-ds-****...M8", env: "生产", usage: "28%", expires: "-", status: "active" },
  { id: "K06", vendor: "OpenAI", alias: "dev-test", maskedKey: "sk-****...T2R7", env: "测试", usage: "8%", expires: "2026-06-01", status: "active" },
  { id: "K07", vendor: "ElevenLabs", alias: "prod-tts", maskedKey: "el-****...V5", env: "生产", usage: "0%", expires: "-", status: "disabled" },
];

export const aiLogs = [
  { id: "L10001", time: "10:32:18", agency: "星辰代理", enterprise: "启明光电", model: "gpt-5.4", tokens: "3,200 / 1,800", cost: 3.48, status: "success", latency: 2800 },
  { id: "L10002", time: "10:32:12", agency: "全球通", enterprise: "义乌商品", model: "gemini-2.5-pro", tokens: "1,600 / 920", cost: 0.66, status: "success", latency: 1400 },
  { id: "L10003", time: "10:32:05", agency: "优贸 OEM", enterprise: "美妆优品", model: "claude-opus-4.6", tokens: "4,800 / 2,400", cost: 25.2, status: "success", latency: 4200 },
  { id: "L10004", time: "10:31:58", agency: "星辰代理", enterprise: "启明光电", model: "gemini-3-pro-image", tokens: "1 image", cost: 4.0, status: "success", latency: 8400 },
  { id: "L10005", time: "10:31:44", agency: "华商网络", enterprise: "海兴渔业", model: "deepseek-v3.2", tokens: "2,400 / 1,100", cost: 0.06, status: "success", latency: 1200 },
  { id: "L10006", time: "10:31:30", agency: "智造站", enterprise: "赛福电子", model: "gpt-5.4", tokens: "0 / 0", cost: 0, status: "error", latency: 0 },
  { id: "L10007", time: "10:31:18", agency: "全球通", enterprise: "义乌商品", model: "veo-3.1-generate", tokens: "15s video", cost: 20.0, status: "success", latency: 68000 },
];

export const hqWallet = {
  balance: 12680000,
  totalRecharge: 48600000,
  totalConsume: 35920000,
  pendingSettle: 1860000,
};

export const hqWalletTxns = [
  { id: "HW001", type: "agency_recharge", direction: "in", amount: 200000, party: "深圳星辰代理", desc: "对公转账充值", date: "2026-04-27 10:32" },
  { id: "HW002", type: "ai_cost", direction: "out", amount: 62400, party: "OpenAI", desc: "4 月模型调用费", date: "2026-04-27 00:05" },
  { id: "HW003", type: "agency_settle", direction: "out", amount: 186000, party: "义乌全球通", desc: "3 月返佣结算", date: "2026-04-26 14:20" },
  { id: "HW004", type: "agency_recharge", direction: "in", amount: 500000, party: "上海华商网络", desc: "年度充值", date: "2026-04-26 09:18" },
  { id: "HW005", type: "ai_cost", direction: "out", amount: 48200, party: "Google Gemini", desc: "4 月模型调用费", date: "2026-04-26 00:05" },
  { id: "HW006", type: "refund", direction: "out", amount: 12800, party: "杭州速建", desc: "订单 O20257 退款", date: "2026-04-25 11:30" },
];

export const hqPlans = [
  { id: "P01", name: "基础版", scope: "企业客户", price: 680, period: "月", sold: 328, features: 8 },
  { id: "P02", name: "专业版", scope: "企业客户", price: 1280, period: "月", sold: 486, features: 14, popular: true },
  { id: "P03", name: "企业版", scope: "企业客户", price: 2800, period: "月", sold: 186, features: 22 },
  { id: "P04", name: "旗舰版", scope: "企业客户", price: 6800, period: "月", sold: 42, features: 32 },
  { id: "P05", name: "代理商 · 白银", scope: "代理商", price: 9800, period: "年", sold: 24, features: 18 },
  { id: "P06", name: "代理商 · 黄金", scope: "代理商", price: 28000, period: "年", sold: 32, features: 28 },
  { id: "P07", name: "代理商 · 白金", scope: "代理商", price: 68000, period: "年", sold: 10, features: 40 },
  { id: "P08", name: "代理商 · 钻石", scope: "代理商", price: 128000, period: "年", sold: 2, features: 52 },
];

export const boosters = [
  { id: "B01", name: "AI 建站 +500 次", price: 198, sold: 680, desc: "额外 500 次 AI 对话建站额度" },
  { id: "B02", name: "AI 博客 +100 篇", price: 298, sold: 420, desc: "额外 100 篇 AI SEO 博客额度" },
  { id: "B03", name: "图片生成 +200 张", price: 168, sold: 560, desc: "额外 200 张 Hero/产品图生成额度" },
  { id: "B04", name: "视频生成 +20 条", price: 398, sold: 186, desc: "额外 20 条短视频生成额度" },
  { id: "B05", name: "站点存储 +50 GB", price: 98, sold: 248, desc: "额外 50 GB 站点静态资源存储" },
  { id: "B06", name: "关键词追踪 +500 词", price: 148, sold: 312, desc: "额外 500 个关键词每日排名追踪" },
];

export const coupons = [
  { code: "SPRING2026", name: "春季 8 折券", discount: "20% off", limit: 1000, used: 628, validUntil: "2026-05-31", status: "active" },
  { code: "NEWYEAR100", name: "新客减 100", discount: "¥100", limit: 500, used: 342, validUntil: "2026-06-30", status: "active" },
  { code: "CANTON2026", name: "广交会专享", discount: "30% off", limit: 200, used: 58, validUntil: "2026-05-15", status: "active" },
  { code: "WELCOME680", name: "新注册免 1 月", discount: "¥680", limit: 10000, used: 4280, validUntil: "2026-12-31", status: "active" },
  { code: "DOUBLE11_2025", name: "双 11 大促", discount: "40% off", limit: 2000, used: 1986, validUntil: "2025-11-30", status: "expired" },
];

export const pointRules = [
  { action: "新注册企业客户", points: 100, type: "获取", enabled: true },
  { action: "首次付费订单", points: 500, type: "获取", enabled: true },
  { action: "邀请新企业注册", points: 200, type: "获取", enabled: true },
  { action: "每日登录", points: 5, type: "获取", enabled: true },
  { action: "发布 SEO 博客", points: 20, type: "获取", enabled: true },
  { action: "兑换 ¥10 代金券", points: 1000, type: "消耗", enabled: true },
  { action: "兑换加油包", points: 3000, type: "消耗", enabled: true },
  { action: "兑换会员 1 个月", points: 8000, type: "消耗", enabled: false },
];

export const hqOrders = [
  { id: "HQ_O9001", party: "义乌全球通", type: "代理商套餐", plan: "代理商·钻石 年付", amount: 128000, status: "paid", date: "2026-04-27" },
  { id: "HQ_O9002", party: "深圳星辰代理", type: "代理商充值", plan: "钱包充值", amount: 200000, status: "auditing", date: "2026-04-27" },
  { id: "HQ_O9003", party: "启明光电", type: "企业套餐", plan: "企业版 年付", amount: 28800, status: "paid", date: "2026-04-26" },
  { id: "HQ_O9004", party: "广州优贸", type: "代理商套餐", plan: "代理商·白金 续费", amount: 68000, status: "pending", date: "2026-04-26" },
  { id: "HQ_O9005", party: "美妆优品", type: "加油包", plan: "AI 建站 +500 次", amount: 198, status: "paid", date: "2026-04-25" },
  { id: "HQ_O9006", party: "杭州速建", type: "退款", plan: "企业版 退款", amount: -12800, status: "refunded", date: "2026-04-25" },
];

export const autoRenewals = [
  { id: "AR001", party: "启明光电", plan: "企业版", nextRenew: "2026-05-15", amount: 28800, card: "**** 4328", status: "active" },
  { id: "AR002", party: "美妆优品", plan: "旗舰版", nextRenew: "2026-05-08", amount: 68000, card: "**** 9917", status: "active" },
  { id: "AR003", party: "赛福电子", plan: "企业版", nextRenew: "2026-05-10", amount: 28800, card: "**** 2264", status: "active" },
  { id: "AR004", party: "义乌小商品", plan: "旗舰版", nextRenew: "2026-05-14", amount: 68000, card: "**** 5580", status: "active" },
  { id: "AR005", party: "杭州纺服", plan: "专业版", nextRenew: "2026-05-03", amount: 12800, card: "**** 1132", status: "paused" },
];

export const refunds = [
  { id: "RF001", party: "杭州速建", order: "HQ_O9006", amount: 12800, reason: "合同解约", status: "approved", date: "2026-04-25" },
  { id: "RF002", party: "海兴渔业", order: "HQ_O8902", amount: 680, reason: "功能不符预期", status: "pending", date: "2026-04-26" },
  { id: "RF003", party: "杭州纺服", order: "HQ_O8850", amount: 4800, reason: "误购", status: "pending", date: "2026-04-27" },
  { id: "RF004", party: "华达机械", order: "HQ_O8820", amount: 2800, reason: "加油包未使用", status: "rejected", date: "2026-04-20" },
];

export const invoices = [
  { id: "INV2601001", party: "义乌全球通", type: "增值税专用发票", amount: 128000, status: "issued", date: "2026-04-27" },
  { id: "INV2601002", party: "深圳星辰代理", type: "增值税专用发票", amount: 500000, status: "issued", date: "2026-04-26" },
  { id: "INV2601003", party: "启明光电", type: "增值税普通发票", amount: 28800, status: "pending", date: "2026-04-26" },
  { id: "INV2601004", party: "美妆优品", type: "增值税专用发票", amount: 68000, status: "pending", date: "2026-04-25" },
  { id: "INV2601005", party: "赛福电子", type: "增值税普通发票", amount: 12800, status: "issued", date: "2026-04-23" },
];

export const announcements = [
  { id: "AN01", title: "【重要】5/1-5/3 服务器维护公告", target: "全平台", priority: "high", views: 8600, published: "2026-04-25", status: "published" },
  { id: "AN02", title: "Gemini 2.5 Pro 模型全面开放", target: "代理商+企业", priority: "medium", views: 5400, published: "2026-04-20", status: "published" },
  { id: "AN03", title: "新版询盘自动化功能上线", target: "企业客户", priority: "medium", views: 3280, published: "2026-04-18", status: "published" },
  { id: "AN04", title: "代理商分销政策 Q2 调整", target: "代理商", priority: "high", views: 1860, published: "2026-04-15", status: "published" },
  { id: "AN05", title: "6 月份活动预告", target: "全平台", priority: "low", views: 0, published: "-", status: "draft" },
];

export const promotions = [
  { id: "PR01", name: "春季建站节", discount: "全场 7 折", scope: "企业套餐", startDate: "2026-04-15", endDate: "2026-05-15", joined: 486, gmv: 2860000, status: "active" },
  { id: "PR02", name: "代理商充 10 送 2", discount: "充值返现 20%", scope: "代理商", startDate: "2026-04-01", endDate: "2026-04-30", joined: 42, gmv: 8400000, status: "active" },
  { id: "PR03", name: "广交会专场", discount: "6 折 + 送加油包", scope: "新注册企业", startDate: "2026-04-15", endDate: "2026-05-05", joined: 186, gmv: 980000, status: "active" },
  { id: "PR04", name: "5.1 劳动节福利", discount: "满 5000 减 500", scope: "全平台", startDate: "2026-05-01", endDate: "2026-05-03", joined: 0, gmv: 0, status: "scheduled" },
];

export const groups = [
  { id: "G01", name: "高价值客户", type: "企业", members: 186, rule: "MRR ≥ 10000", createdBy: "李运营" },
  { id: "G02", name: "续费风险", type: "企业", members: 42, rule: "到期 <30 天 未续费", createdBy: "赵客服" },
  { id: "G03", name: "白金代理商", type: "代理商", members: 3, rule: "level=白金", createdBy: "系统" },
  { id: "G04", name: "沉睡客户", type: "企业", members: 128, rule: "30 天未登录", createdBy: "孙市场" },
  { id: "G05", name: "AI 重度用户", type: "企业", members: 86, rule: "月 AI 消费 ≥1000", createdBy: "陈技术" },
];

export const csat = {
  nps: 68,
  csat: 4.6,
  totalResponses: 3280,
  byCategory: [
    { category: "AI 建站体验", score: 4.8, responses: 860 },
    { category: "SEO 工具", score: 4.5, responses: 620 },
    { category: "客服响应", score: 4.7, responses: 980 },
    { category: "订单流程", score: 4.4, responses: 420 },
    { category: "平台稳定性", score: 4.6, responses: 400 },
  ],
};

export const qaPlans = [
  { id: "QP01", name: "Q2 产品满意度调研", target: "全企业", channel: "站内+邮件", sent: 1240, responses: 628, rate: "50.6%", status: "active" },
  { id: "QP02", name: "代理商年度访谈", target: "钻石+白金代理商", channel: "1v1 电话", sent: 18, responses: 16, rate: "88.9%", status: "active" },
  { id: "QP03", name: "新注册引导调研", target: "新注册企业", channel: "站内", sent: 486, responses: 312, rate: "64.2%", status: "active" },
  { id: "QP04", name: "流失客户回访", target: "30 天流失", channel: "电话", sent: 128, responses: 42, rate: "32.8%", status: "done" },
];

export const qaTasks = [
  { id: "QT01", plan: "Q2 产品满意度调研", assignee: "孙市场", target: "启明光电", status: "done", score: 4.8, date: "2026-04-25" },
  { id: "QT02", plan: "Q2 产品满意度调研", assignee: "孙市场", target: "美妆优品", status: "done", score: 4.6, date: "2026-04-24" },
  { id: "QT03", plan: "代理商年度访谈", assignee: "李运营", target: "义乌全球通", status: "in_progress", score: 0, date: "2026-04-28" },
  { id: "QT04", plan: "新注册引导调研", assignee: "赵客服", target: "海兴渔业", status: "pending", score: 0, date: "-" },
  { id: "QT05", plan: "流失客户回访", assignee: "赵客服", target: "(沉睡) 昌达贸易", status: "done", score: 3.2, date: "2026-04-18" },
];

export const inquiryAuto = [
  { id: "IA01", name: "询盘自动回复 - 英语", trigger: "收到新询盘 且 语言=EN", action: "24h 内发送 AI 感谢邮件 + 产品册", enabled: true, triggered: 3860 },
  { id: "IA02", name: "询盘自动分配", trigger: "询盘国家=US/EU", action: "分配给销售 A 组", enabled: true, triggered: 1240 },
  { id: "IA03", name: "高价值询盘提醒", trigger: "询盘产品金额 >5000", action: "微信+钉钉通知销售主管", enabled: true, triggered: 186 },
  { id: "IA04", name: "长时间未回复升级", trigger: "询盘 >48h 未回复", action: "升级至销售经理", enabled: true, triggered: 42 },
  { id: "IA05", name: "询盘评分", trigger: "新询盘", action: "AI 打分 + 贴标签", enabled: true, triggered: 6280 },
];

export const tdkRules = [
  { id: "T01", name: "产品页标题规则", scope: "产品详情页", template: "{产品名} | {品牌} - {类目} 供应商", enabled: true },
  { id: "T02", name: "产品页描述规则", scope: "产品详情页", template: "Buy {产品名} from {品牌}. {卖点}. Free quote, fast shipping.", enabled: true },
  { id: "T03", name: "首页 TDK", scope: "首页", template: "{品牌} - Leading {行业} Manufacturer | {国家} Exporter", enabled: true },
  { id: "T04", name: "博客页规则", scope: "博客详情", template: "{文章标题} - {品牌} Blog", enabled: true },
  { id: "T05", name: "分类页规则", scope: "产品分类", template: "{类目} - {品牌} Wholesale & Export", enabled: false },
];

export const seoBlogPlans = [
  { id: "SB01", name: "LED 照明 - 50 篇计划", target: "启明光电", progress: 32, total: 50, aiGen: "90%", status: "running" },
  { id: "SB02", name: "美妆行业 - 100 篇计划", target: "美妆优品", progress: 68, total: 100, aiGen: "85%", status: "running" },
  { id: "SB03", name: "机械设备 - 30 篇计划", target: "华达机械", progress: 18, total: 30, aiGen: "95%", status: "running" },
  { id: "SB04", name: "消费电子 - 80 篇计划", target: "赛福电子", progress: 80, total: 80, aiGen: "88%", status: "done" },
  { id: "SB05", name: "义乌综合贸易", target: "义乌小商品", progress: 0, total: 200, aiGen: "-", status: "pending" },
];

export const notifyConfigs = [
  { event: "新注册企业", channels: ["站内", "邮件"], target: "运营团队", enabled: true },
  { event: "代理商充值待审核", channels: ["站内", "邮件", "钉钉"], target: "审核员", enabled: true },
  { event: "OEM 提交待审核", channels: ["站内", "邮件"], target: "审核员", enabled: true },
  { event: "订单支付成功", channels: ["站内", "邮件"], target: "客户+财务", enabled: true },
  { event: "服务即将到期（7 天）", channels: ["站内", "邮件", "短信"], target: "客户", enabled: true },
  { event: "AI 成本超预算", channels: ["钉钉", "短信"], target: "技术+财务", enabled: true },
  { event: "平台异常告警", channels: ["钉钉", "短信", "电话"], target: "技术值班", enabled: true },
];

export const expiringServices = [
  { id: "EX01", party: "杭州纺服", plan: "专业版", expires: "2026-05-03", daysLeft: 6, notified: 2, status: "warning" },
  { id: "EX02", party: "华达机械", plan: "企业版", expires: "2026-05-15", daysLeft: 18, notified: 1, status: "ok" },
  { id: "EX03", party: "启明光电", plan: "企业版", expires: "2026-05-15", daysLeft: 18, notified: 1, status: "ok" },
  { id: "EX04", party: "美妆优品", plan: "旗舰版", expires: "2026-05-08", daysLeft: 11, notified: 2, status: "warning" },
  { id: "EX05", party: "广州优贸", plan: "代理商·白金", expires: "2026-05-02", daysLeft: 5, notified: 3, status: "danger" },
];

export const paymentChannels = [
  { id: "PC01", name: "支付宝", type: "第三方", fee: "0.6%", status: "active", monthVol: 1860000, icon: "💙" },
  { id: "PC02", name: "微信支付", type: "第三方", fee: "0.6%", status: "active", monthVol: 1240000, icon: "💚" },
  { id: "PC03", name: "对公转账", type: "银行", fee: "¥10/笔", status: "active", monthVol: 8600000, icon: "🏦" },
  { id: "PC04", name: "Stripe", type: "国际", fee: "2.9% + $0.30", status: "active", monthVol: 320000, icon: "💳" },
  { id: "PC05", name: "PayPal", type: "国际", fee: "4.4%", status: "paused", monthVol: 0, icon: "🔵" },
];

export const alertRules = [
  { id: "AR01", name: "AI 成本异常", condition: "日成本 >¥10000", severity: "critical", channels: ["钉钉", "短信"], triggered: 2, enabled: true },
  { id: "AR02", name: "站点宕机", condition: "连续 3 分钟无响应", severity: "critical", channels: ["电话", "钉钉"], triggered: 0, enabled: true },
  { id: "AR03", name: "API 错误率", condition: "5 分钟 >5%", severity: "warning", channels: ["钉钉"], triggered: 4, enabled: true },
  { id: "AR04", name: "支付失败率", condition: "小时 >10%", severity: "warning", channels: ["钉钉", "邮件"], triggered: 1, enabled: true },
  { id: "AR05", name: "代理商钱包负数", condition: "余额 <0", severity: "high", channels: ["钉钉", "站内"], triggered: 0, enabled: true },
  { id: "AR06", name: "模型 Key 额度耗尽", condition: "Key 用量 >95%", severity: "high", channels: ["钉钉", "邮件"], triggered: 1, enabled: true },
];

export const auditLogs = [
  { id: "AL10001", time: "2026-04-27 10:42:18", user: "王总", action: "更新 AI 模型配置", target: "gpt-5.4 定价", ip: "192.168.1.10", result: "success" },
  { id: "AL10002", time: "2026-04-27 10:35:02", user: "刘审核", action: "审核通过充值", target: "RA2003 ¥500000", ip: "192.168.1.22", result: "success" },
  { id: "AL10003", time: "2026-04-27 10:28:44", user: "李运营", action: "发布公告", target: "AN01", ip: "192.168.1.15", result: "success" },
  { id: "AL10004", time: "2026-04-27 10:15:20", user: "张财务", action: "导出账单", target: "4 月代理商账单", ip: "192.168.1.18", result: "success" },
  { id: "AL10005", time: "2026-04-27 09:52:10", user: "陈技术", action: "创建 AI Key", target: "prod-backup", ip: "192.168.1.25", result: "success" },
  { id: "AL10006", time: "2026-04-27 09:18:32", user: "刘审核", action: "拒绝充值", target: "RA2005 ¥80000", ip: "192.168.1.22", result: "success" },
  { id: "AL10007", time: "2026-04-27 08:45:12", user: "unknown", action: "登录失败", target: "hq-admin", ip: "45.132.22.88", result: "failed" },
  { id: "AL10008", time: "2026-04-27 08:32:05", user: "赵客服", action: "修改客户信息", target: "启明光电", ip: "192.168.1.30", result: "success" },
];