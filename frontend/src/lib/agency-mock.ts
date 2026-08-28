// Agency platform mock data
export const agencyKpis = {
  totalEnterprises: 48,
  activeSites: 126,
  mrr: 285600,
  totalOrders: 342,
  pendingTasks: 23,
  teamMembers: 18,
  walletBalance: 485230,
  monthlyNewClients: 12,
};

export const enterprises = [
  { id: "E001", name: "深圳市启明光电有限公司", industry: "LED 照明", sites: 3, orders: 42, mrr: 8800, status: "active", owner: "张经理", joined: "2024-03-15", contact: "contact@qiming-led.com" },
  { id: "E002", name: "宁波华达机械制造", industry: "机械设备", sites: 2, orders: 28, mrr: 6800, status: "active", owner: "李经理", joined: "2024-05-22", contact: "info@huada.com" },
  { id: "E003", name: "广州美妆优品股份", industry: "美妆个护", sites: 5, orders: 87, mrr: 15800, status: "active", owner: "王经理", joined: "2023-11-08", contact: "hi@meizhuang.com" },
  { id: "E004", name: "青岛海兴渔业出口", industry: "食品饮料", sites: 1, orders: 18, mrr: 3200, status: "trial", owner: "张经理", joined: "2026-04-01", contact: "export@haixing.cn" },
  { id: "E005", name: "苏州精艺工艺品有限公司", industry: "工艺礼品", sites: 2, orders: 31, mrr: 5600, status: "active", owner: "陈经理", joined: "2024-08-19", contact: "info@jingyi-crafts.com" },
  { id: "E006", name: "东莞赛福电子科技", industry: "消费电子", sites: 4, orders: 62, mrr: 12400, status: "active", owner: "李经理", joined: "2024-01-10", contact: "sales@saifu-tech.com" },
  { id: "E007", name: "义乌小商品外贸通", industry: "综合贸易", sites: 6, orders: 98, mrr: 18600, status: "active", owner: "王经理", joined: "2023-06-14", contact: "trade@yiwu-go.com" },
  { id: "E008", name: "杭州纺服集团", industry: "服装纺织", sites: 2, orders: 22, mrr: 4800, status: "paused", owner: "陈经理", joined: "2024-02-28", contact: "info@hzfz.com" },
];

export const agencyCustomers = [
  { id: "C1001", name: "John Anderson", company: "Bright Home Ltd.", country: "🇺🇸 美国", enterprise: "启明光电", amount: 28400, status: "signed", lastContact: "2026-04-25" },
  { id: "C1002", name: "Maria García", company: "Iluminación Pro SL", country: "🇪🇸 西班牙", enterprise: "启明光电", amount: 18200, status: "negotiating", lastContact: "2026-04-24" },
  { id: "C1003", name: "Klaus Weber", company: "MaschinenTech GmbH", country: "🇩🇪 德国", enterprise: "华达机械", amount: 86000, status: "signed", lastContact: "2026-04-22" },
  { id: "C1004", name: "Sakura Tanaka", company: "Beauty Imports KK", country: "🇯🇵 日本", enterprise: "美妆优品", amount: 12800, status: "lead", lastContact: "2026-04-26" },
  { id: "C1005", name: "Pierre Dubois", company: "Artisan Import SARL", country: "🇫🇷 法国", enterprise: "精艺工艺品", amount: 9600, status: "negotiating", lastContact: "2026-04-21" },
  { id: "C1006", name: "Ahmed Hassan", company: "Gulf Electronics LLC", country: "🇦🇪 阿联酋", enterprise: "赛福电子", amount: 45000, status: "signed", lastContact: "2026-04-20" },
  { id: "C1007", name: "Emma Wilson", company: "Fashion House UK", country: "🇬🇧 英国", enterprise: "杭州纺服", amount: 22000, status: "lead", lastContact: "2026-04-23" },
  { id: "C1008", name: "Roberto Silva", company: "Brasil Trading", country: "🇧🇷 巴西", enterprise: "义乌小商品", amount: 15600, status: "negotiating", lastContact: "2026-04-25" },
];

export const agencySites = [
  { id: "S201", name: "LumiTech Global", domain: "lumitech-global.com", enterprise: "启明光电", traffic: 28400, inquiries: 156, status: "online", template: "Industrial Pro", updated: "2 小时前" },
  { id: "S202", name: "Huada Machinery", domain: "huada-machine.com", enterprise: "华达机械", traffic: 12800, inquiries: 89, status: "online", template: "Factory Plus", updated: "5 小时前" },
  { id: "S203", name: "Meizhuang Beauty", domain: "meizhuang-beauty.com", enterprise: "美妆优品", traffic: 45600, inquiries: 312, status: "online", template: "Elegance", updated: "1 天前" },
  { id: "S204", name: "Haixing Seafood", domain: "haixing-export.com", enterprise: "海兴渔业", traffic: 6200, inquiries: 34, status: "building", template: "Food Fresh", updated: "3 天前" },
  { id: "S205", name: "Jingyi Crafts", domain: "jingyi-crafts.com", enterprise: "精艺工艺品", traffic: 8900, inquiries: 62, status: "online", template: "Artisan", updated: "6 小时前" },
  { id: "S206", name: "Saifu Electronics", domain: "saifu-tech.com", enterprise: "赛福电子", traffic: 32100, inquiries: 198, status: "online", template: "Tech Modern", updated: "4 小时前" },
  { id: "S207", name: "Yiwu Trading Hub", domain: "yiwu-go.com", enterprise: "义乌小商品", traffic: 56700, inquiries: 428, status: "online", template: "Marketplace", updated: "1 小时前" },
  { id: "S208", name: "HZ Fashion", domain: "hzfz-fashion.com", enterprise: "杭州纺服", traffic: 4200, inquiries: 18, status: "paused", template: "Fashion Lux", updated: "5 天前" },
];

export const agencyOrders = [
  { id: "O20261", enterprise: "启明光电", plan: "专业版 · 年付", amount: 12800, status: "paid", method: "对公转账", date: "2026-04-26", invoice: "已开" },
  { id: "O20260", enterprise: "华达机械", plan: "企业版 · 年付", amount: 28800, status: "paid", method: "支付宝", date: "2026-04-24", invoice: "已开" },
  { id: "O20259", enterprise: "美妆优品", plan: "旗舰版 · 年付", amount: 68000, status: "pending", method: "对公转账", date: "2026-04-23", invoice: "待开" },
  { id: "O20258", enterprise: "海兴渔业", plan: "基础版 · 月付", amount: 680, status: "paid", method: "微信", date: "2026-04-22", invoice: "-" },
  { id: "O20257", enterprise: "赛福电子", plan: "专业版 · 年付", amount: 12800, status: "refund", method: "对公转账", date: "2026-04-20", invoice: "已退" },
  { id: "O20256", enterprise: "义乌小商品", plan: "企业版 · 年付", amount: 28800, status: "paid", method: "对公转账", date: "2026-04-18", invoice: "已开" },
];

export const reports = [
  { id: "R501", customer: "John Anderson", from: "张经理", enterprise: "启明光电", status: "approved", expires: "2026-05-30", createdAt: "2026-04-25" },
  { id: "R502", customer: "Maria García", from: "张经理", enterprise: "启明光电", status: "approved", expires: "2026-05-28", createdAt: "2026-04-23" },
  { id: "R503", customer: "Emma Wilson", from: "陈经理", enterprise: "杭州纺服", status: "pending", expires: "-", createdAt: "2026-04-26" },
  { id: "R504", customer: "Ahmed Hassan", from: "李经理", enterprise: "赛福电子", status: "approved", expires: "2026-05-20", createdAt: "2026-04-20" },
  { id: "R505", customer: "Paul Chen", from: "王经理", enterprise: "美妆优品", status: "rejected", expires: "-", createdAt: "2026-04-19" },
];

export const publicPool = [
  { id: "P801", customer: "Lisa Brown", company: "HomeStyle Inc.", country: "🇨🇦 加拿大", reason: "报备到期未跟进", available: "2026-04-25", value: 18000 },
  { id: "P802", customer: "Olaf Nielsen", company: "Nordic Lights AB", country: "🇸🇪 瑞典", reason: "业务员离职", available: "2026-04-20", value: 32000 },
  { id: "P803", customer: "Priya Sharma", company: "Mumbai Exports", country: "🇮🇳 印度", reason: "主动释放", available: "2026-04-18", value: 8600 },
  { id: "P804", customer: "Diego Ramirez", company: "Latin Traders SA", country: "🇲🇽 墨西哥", reason: "报备到期未跟进", available: "2026-04-15", value: 24000 },
];

export const businessData = [
  { month: "2025-11", revenue: 186000, orders: 28, newClients: 8, gmv: 920000 },
  { month: "2025-12", revenue: 215000, orders: 34, newClients: 11, gmv: 1080000 },
  { month: "2026-01", revenue: 242000, orders: 41, newClients: 14, gmv: 1230000 },
  { month: "2026-02", revenue: 228000, orders: 38, newClients: 9, gmv: 1156000 },
  { month: "2026-03", revenue: 268000, orders: 45, newClients: 13, gmv: 1380000 },
  { month: "2026-04", revenue: 285600, orders: 48, newClients: 12, gmv: 1462000 },
];

export const seoTasks = [
  { id: "T301", title: "LED Lighting 长尾词挖掘", site: "lumitech-global.com", assignee: "张小美", status: "in_progress", priority: "high", due: "2026-05-02" },
  { id: "T302", title: "Meta Description 批量优化（32 页）", site: "meizhuang-beauty.com", assignee: "李小华", status: "done", priority: "medium", due: "2026-04-25" },
  { id: "T303", title: "技术 SEO 审计", site: "huada-machine.com", assignee: "王小强", status: "pending", priority: "high", due: "2026-05-08" },
  { id: "T304", title: "外链建设 Q2", site: "saifu-tech.com", assignee: "赵小敏", status: "in_progress", priority: "medium", due: "2026-05-15" },
  { id: "T305", title: "Site Map 提交", site: "yiwu-go.com", assignee: "张小美", status: "done", priority: "low", due: "2026-04-20" },
];

export const seoTools = [
  { name: "关键词挖掘", desc: "基于 Google Trends + Ahrefs 的长尾词发现", icon: "Search", used: 1280, quota: 5000 },
  { name: "站点审计", desc: "一键检测技术 SEO 问题", icon: "Activity", used: 48, quota: 200 },
  { name: "竞品分析", desc: "对标同行的流量与关键词", icon: "Target", used: 96, quota: 500 },
  { name: "外链监测", desc: "跟踪外链增长与失效", icon: "Link2", used: 3200, quota: 20000 },
  { name: "AI 内容生成", desc: "根据关键词批量生成文章", icon: "Sparkles", used: 220, quota: 1000 },
  { name: "排名追踪", desc: "每日监测目标词 SERP 排名", icon: "TrendingUp", used: 680, quota: 2000 },
];

export const seoBlogs = [
  { id: "B401", title: "Top 10 LED Lighting Trends for 2026 Global Markets", site: "lumitech-global.com", author: "AI + 张小美", words: 2400, status: "published", views: 3200, publishedAt: "2026-04-20" },
  { id: "B402", title: "How to Choose the Right Industrial Machinery Supplier", site: "huada-machine.com", author: "AI", words: 1800, status: "published", views: 1680, publishedAt: "2026-04-18" },
  { id: "B403", title: "2026 Beauty Industry Export Guide for EU Buyers", site: "meizhuang-beauty.com", author: "李小华", words: 3100, status: "review", views: 0, publishedAt: "-" },
  { id: "B404", title: "Understanding CE Certification for Consumer Electronics", site: "saifu-tech.com", author: "AI", words: 2200, status: "draft", views: 0, publishedAt: "-" },
  { id: "B405", title: "The Ultimate Buyer's Guide to Chinese Wholesale Markets", site: "yiwu-go.com", author: "王小强", words: 4500, status: "published", views: 8900, publishedAt: "2026-04-15" },
];

export const teamMembers = [
  { id: "M101", name: "张小美", email: "zhang@agency.com", role: "销售主管", department: "业务一部", status: "active", clients: 12, performance: 185, joined: "2023-05-18", avatar: "张" },
  { id: "M102", name: "李小华", email: "li@agency.com", role: "SEO 专员", department: "运营部", status: "active", clients: 8, performance: 142, joined: "2024-01-10", avatar: "李" },
  { id: "M103", name: "王小强", email: "wang@agency.com", role: "销售经理", department: "业务二部", status: "active", clients: 15, performance: 220, joined: "2022-11-22", avatar: "王" },
  { id: "M104", name: "赵小敏", email: "zhao@agency.com", role: "客户成功", department: "服务部", status: "active", clients: 20, performance: 168, joined: "2024-03-05", avatar: "赵" },
  { id: "M105", name: "陈小伟", email: "chen@agency.com", role: "销售", department: "业务一部", status: "active", clients: 6, performance: 98, joined: "2024-08-15", avatar: "陈" },
  { id: "M106", name: "林小芳", email: "lin@agency.com", role: "运营", department: "运营部", status: "leave", clients: 0, performance: 0, joined: "2023-09-20", avatar: "林" },
];

export const roles = [
  { id: "R01", name: "超级管理员", members: 2, permissions: ["所有权限"], desc: "拥有全部系统权限" },
  { id: "R02", name: "销售主管", members: 3, permissions: ["客户管理", "订单管理", "公海池", "绩效查看"], desc: "管理销售团队与客户" },
  { id: "R03", name: "销售经理", members: 5, permissions: ["客户管理（部分）", "订单查看", "报备"], desc: "一线销售业务" },
  { id: "R04", name: "SEO 专员", members: 3, permissions: ["SEO 工具", "博客管理", "站点编辑"], desc: "内容与优化" },
  { id: "R05", name: "客户成功", members: 4, permissions: ["客户查看", "工单处理", "站点支持"], desc: "售后与支持" },
  { id: "R06", name: "财务", members: 1, permissions: ["订单查看", "钱包管理", "发票"], desc: "财务结算" },
];

export const quotas = [
  { resource: "AI 对话建站次数", limit: 5000, used: 2840, unit: "次/月" },
  { resource: "AI 博客生成", limit: 1000, used: 380, unit: "篇/月" },
  { resource: "SEO 站点审计", limit: 200, used: 48, unit: "次/月" },
  { resource: "关键词排名追踪", limit: 2000, used: 680, unit: "词/日" },
  { resource: "图片生成（Hero/产品图）", limit: 3000, used: 1280, unit: "张/月" },
  { resource: "短信验证码", limit: 10000, used: 3420, unit: "条/月" },
  { resource: "站点存储", limit: 500, used: 186, unit: "GB" },
  { resource: "API 调用", limit: 1000000, used: 432000, unit: "次/月" },
];

export const performance = [
  { name: "王小强", role: "销售经理", newClients: 8, revenue: 156000, tasks: 42, completion: 95, rank: 1 },
  { name: "张小美", role: "销售主管", newClients: 6, revenue: 128000, tasks: 38, completion: 92, rank: 2 },
  { name: "赵小敏", role: "客户成功", newClients: 4, revenue: 96000, tasks: 52, completion: 88, rank: 3 },
  { name: "李小华", role: "SEO 专员", newClients: 3, revenue: 72000, tasks: 35, completion: 91, rank: 4 },
  { name: "陈小伟", role: "销售", newClients: 3, revenue: 58000, tasks: 28, completion: 82, rank: 5 },
];

export const plans = [
  { id: "PL01", name: "基础版", price: 680, period: "月", sites: 1, features: ["1 个站点", "基础模板", "100 次 AI 建站/月", "社区支持"], subscribers: 18, color: "slate" },
  { id: "PL02", name: "专业版", price: 1280, period: "月", sites: 3, features: ["3 个站点", "全部模板", "500 次 AI 建站/月", "SEO 工具", "邮件支持"], subscribers: 24, color: "blue", popular: true },
  { id: "PL03", name: "企业版", price: 2800, period: "月", sites: 10, features: ["10 个站点", "全部模板 + OEM", "无限 AI 建站", "全套 SEO 工具", "1v1 客户经理"], subscribers: 12, color: "purple" },
  { id: "PL04", name: "旗舰版", price: 6800, period: "月", sites: 99, features: ["无限站点", "白标定制", "专属 API", "专属团队", "SLA 99.9%"], subscribers: 4, color: "amber" },
];

export const walletTxns = [
  { id: "W901", type: "recharge", amount: 50000, balance: 485230, method: "对公转账", desc: "账户充值", date: "2026-04-25 10:32" },
  { id: "W902", type: "consume", amount: -12800, balance: 435230, method: "-", desc: "启明光电 专业版续费", date: "2026-04-24 14:18" },
  { id: "W903", type: "consume", amount: -8800, balance: 448030, method: "-", desc: "AI 图片生成 1200 张", date: "2026-04-22 09:44" },
  { id: "W904", type: "recharge", amount: 100000, balance: 456830, method: "支付宝", desc: "账户充值", date: "2026-04-20 16:20" },
  { id: "W905", type: "consume", amount: -28800, balance: 356830, method: "-", desc: "华达机械 企业版年费", date: "2026-04-18 11:05" },
  { id: "W906", type: "refund", amount: 12800, balance: 385630, method: "-", desc: "赛福电子退款", date: "2026-04-16 15:30" },
];

export const inviteLinks = [
  { id: "IL001", name: "4月春季推广", url: "https://agency.example.com/r/spring2026", clicks: 328, signups: 42, converted: 18, created: "2026-04-01", status: "active" },
  { id: "IL002", name: "广交会引流", url: "https://agency.example.com/r/canton-fair", clicks: 1240, signups: 186, converted: 58, created: "2026-04-10", status: "active" },
  { id: "IL003", name: "老客户推荐", url: "https://agency.example.com/r/referral", clicks: 86, signups: 24, converted: 12, created: "2026-03-15", status: "active" },
  { id: "IL004", name: "双11 活动（已结束）", url: "https://agency.example.com/r/double11", clicks: 2180, signups: 312, converted: 98, created: "2025-11-01", status: "expired" },
];