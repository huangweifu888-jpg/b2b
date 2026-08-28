export const dashboardStats = [
  { label: "今日询盘", value: "128", change: "+12.5%", trend: "up", color: "blue" },
  { label: "本月访客", value: "48,290", change: "+8.2%", trend: "up", color: "sky" },
  { label: "关键词排名 TOP10", value: "326", change: "+24", trend: "up", color: "emerald" },
  { label: "积分余额", value: "12,580", change: "-320", trend: "down", color: "amber" },
];

export const trafficData = [
  { date: "04-20", visitors: 1240, inquiries: 28 },
  { date: "04-21", visitors: 1380, inquiries: 32 },
  { date: "04-22", visitors: 1520, inquiries: 41 },
  { date: "04-23", visitors: 1680, inquiries: 38 },
  { date: "04-24", visitors: 1890, inquiries: 52 },
  { date: "04-25", visitors: 2100, inquiries: 67 },
  { date: "04-26", visitors: 2340, inquiries: 128 },
];

export const sourceData = [
  { name: "Google", value: 4820, color: "#2563eb" },
  { name: "Bing", value: 1240, color: "#0ea5e9" },
  { name: "直接访问", value: 890, color: "#10b981" },
  { name: "社交媒体", value: 560, color: "#f59e0b" },
  { name: "其他", value: 320, color: "#64748b" },
];

export const recentInquiries = [
  { id: "INQ-2048", name: "John Smith", company: "ABC Trading Ltd.", country: "🇺🇸 USA", product: "LED Bulb 9W", time: "5 分钟前", status: "new" },
  { id: "INQ-2047", name: "Maria Garcia", company: "EuroTech GmbH", country: "🇩🇪 Germany", product: "Solar Panel 400W", time: "18 分钟前", status: "replied" },
  { id: "INQ-2046", name: "Ahmed Hassan", company: "Cairo Imports", country: "🇪🇬 Egypt", product: "Industrial Valve", time: "1 小时前", status: "new" },
  { id: "INQ-2045", name: "Yuki Tanaka", company: "Tokyo Supply Co.", country: "🇯🇵 Japan", product: "Steel Pipe DN50", time: "2 小时前", status: "pending" },
  { id: "INQ-2044", name: "Pierre Dubois", company: "Lyon Commerce", country: "🇫🇷 France", product: "Aluminum Profile", time: "3 小时前", status: "replied" },
];

export const projects = [
  { id: 1, name: "LED 照明独立站", domain: "ledlight-export.com", status: "online", traffic: 12840, inquiries: 128, updated: "2026-04-26" },
  { id: 2, name: "太阳能产品站", domain: "solarpro-global.com", status: "online", traffic: 8920, inquiries: 87, updated: "2026-04-25" },
  { id: 3, name: "工业阀门站", domain: "valve-industry.com", status: "building", traffic: 3240, inquiries: 24, updated: "2026-04-24" },
  { id: 4, name: "不锈钢制品站", domain: "steel-export.net", status: "online", traffic: 5680, inquiries: 56, updated: "2026-04-23" },
  { id: 5, name: "电动工具站", domain: "powertools-wholesale.com", status: "draft", traffic: 0, inquiries: 0, updated: "2026-04-22" },
];

export const templates = [
  { id: 1, name: "外贸电商经典版", category: "通用", preview: "gradient-blue", uses: 2840, rating: 4.9 },
  { id: 2, name: "工业制造专业版", category: "工业", preview: "gradient-slate", uses: 1520, rating: 4.8 },
  { id: 3, name: "简约科技风", category: "通用", preview: "gradient-emerald", uses: 3120, rating: 4.9 },
  { id: 4, name: "LED 照明主题", category: "照明", preview: "gradient-amber", uses: 890, rating: 4.7 },
  { id: 5, name: "太阳能能源主题", category: "能源", preview: "gradient-sky", uses: 720, rating: 4.8 },
  { id: 6, name: "五金机电版", category: "工业", preview: "gradient-rose", uses: 1080, rating: 4.6 },
];

export const customers = [
  { id: 1, name: "John Smith", company: "ABC Trading Ltd.", country: "USA", email: "john@abc-trade.com", tags: ["VIP", "LED"], inquiries: 12, lastContact: "2026-04-26" },
  { id: 2, name: "Maria Garcia", company: "EuroTech GmbH", country: "Germany", email: "maria@eurotech.de", tags: ["Solar"], inquiries: 8, lastContact: "2026-04-26" },
  { id: 3, name: "Ahmed Hassan", company: "Cairo Imports", country: "Egypt", email: "ahmed@cairo-imp.com", tags: ["工业"], inquiries: 5, lastContact: "2026-04-26" },
  { id: 4, name: "Yuki Tanaka", company: "Tokyo Supply Co.", country: "Japan", email: "yuki@tokyo-sup.co.jp", tags: ["VIP", "钢铁"], inquiries: 15, lastContact: "2026-04-26" },
  { id: 5, name: "Pierre Dubois", company: "Lyon Commerce", country: "France", email: "pierre@lyon-com.fr", tags: ["铝材"], inquiries: 6, lastContact: "2026-04-26" },
  { id: 6, name: "Carlos Silva", company: "SP Industries", country: "Brazil", email: "carlos@sp-ind.br", tags: ["LED"], inquiries: 9, lastContact: "2026-04-25" },
];

export const products = [
  { id: 1, name: "LED Bulb 9W E27", sku: "LED-9W-E27", category: "LED 灯泡", price: "$1.20", stock: 12800, views: 3240, inquiries: 48 },
  { id: 2, name: "Solar Panel 400W Mono", sku: "SP-400W-M", category: "太阳能板", price: "$128.00", stock: 520, views: 1890, inquiries: 32 },
  { id: 3, name: "Industrial Ball Valve DN50", sku: "BV-DN50-SS", category: "工业阀门", price: "$18.50", stock: 2400, views: 980, inquiries: 24 },
  { id: 4, name: "Steel Pipe Seamless DN100", sku: "SP-DN100-S", category: "钢管", price: "$42.00", stock: 1800, views: 1240, inquiries: 18 },
  { id: 5, name: "Aluminum Profile 6063-T5", sku: "ALP-6063-T5", category: "铝型材", price: "$3.80", stock: 8500, views: 2140, inquiries: 29 },
  { id: 6, name: "LED Panel Light 36W", sku: "LPL-36W", category: "LED 面板", price: "$8.90", stock: 5600, views: 1680, inquiries: 22 },
];

export const keywords = [
  { kw: "led bulb wholesale", volume: 8100, difficulty: 42, rank: 3, change: 2, cpc: "$1.20" },
  { kw: "solar panel manufacturer", volume: 12400, difficulty: 58, rank: 8, change: -1, cpc: "$3.80" },
  { kw: "industrial ball valve supplier", volume: 3200, difficulty: 35, rank: 5, change: 3, cpc: "$2.10" },
  { kw: "aluminum profile china", volume: 4800, difficulty: 48, rank: 12, change: 4, cpc: "$1.80" },
  { kw: "led panel light factory", volume: 2900, difficulty: 38, rank: 6, change: 0, cpc: "$1.40" },
  { kw: "steel pipe export", volume: 1800, difficulty: 32, rank: 4, change: 1, cpc: "$2.50" },
  { kw: "9w led bulb price", volume: 5400, difficulty: 28, rank: 2, change: 5, cpc: "$0.90" },
  { kw: "mono solar panel 400w", volume: 3600, difficulty: 45, rank: 7, change: -2, cpc: "$3.20" },
];