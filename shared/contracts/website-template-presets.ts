export type WebsiteTemplatePreset = {
  id: string;
  name: string;
  category: string;
  summary: string;
  brandName: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaText: string;
  primaryColor: string;
  layoutVariant: "summit" | "catalog" | "showcase";
  preview: string;
  sortCode: string;
  productTags: string[];
  trendTags: string[];
  supportTags: string[];
  notes: string;
  pageSpeedLabel: string;
  ampReady: boolean;
  pricingTier: "free" | "paid";
  rating: number;
  uses: number;
  thumbnail: string;
  html: string;
  pages?: string[];
  industry?: string;
  languages?: string[];
  marketingCapabilities?: string[];
  contentSyncSources?: string[];
};

const STORAGE_KEY = "wzfg.website-template-presets";
const UPDATE_EVENT = "website-template-presets-updated";

function buildTemplateHtml(preset: WebsiteTemplatePreset) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${preset.name}</title>
    <style>
      :root {
        --brand: ${preset.primaryColor};
        --ink: #0f172a;
        --muted: #475569;
        --line: rgba(15, 23, 42, 0.08);
        --card: rgba(255, 255, 255, 0.92);
        --bg: linear-gradient(135deg, #f8fafc 0%, #eff6ff 35%, #ecfeff 100%);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
        color: var(--ink);
        background: var(--bg);
      }
      .hero {
        padding: 56px 24px 36px;
      }
      .shell {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
      }
      .nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        margin-bottom: 38px;
      }
      .brand {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--brand);
      }
      .cta {
        border: 0;
        border-radius: 999px;
        padding: 12px 22px;
        font-size: 14px;
        font-weight: 700;
        color: #ffffff;
        background: var(--brand);
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.14);
      }
      .hero-grid {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 24px;
        align-items: stretch;
      }
      .headline {
        border: 1px solid var(--line);
        border-radius: 28px;
        background: var(--card);
        padding: 32px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
      }
      .headline h1 {
        margin: 0;
        font-size: clamp(34px, 4vw, 54px);
        line-height: 1.08;
      }
      .headline p {
        margin: 18px 0 0;
        color: var(--muted);
        font-size: 16px;
        line-height: 1.8;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .card {
        border: 1px solid var(--line);
        border-radius: 24px;
        background: rgba(255,255,255,0.88);
        padding: 22px;
      }
      .card strong {
        display: block;
        font-size: 28px;
      }
      .card span {
        display: block;
        margin-top: 8px;
        color: var(--muted);
        font-size: 13px;
      }
      .section {
        padding: 0 24px 56px;
      }
      .section-grid {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
      }
      .panel {
        border: 1px solid var(--line);
        border-radius: 24px;
        background: rgba(255,255,255,0.9);
        padding: 22px;
      }
      .panel h3 {
        margin: 0 0 10px;
        font-size: 18px;
      }
      .panel p {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
        font-size: 14px;
      }
      .tag {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 7px 12px;
        margin: 0 8px 8px 0;
        font-size: 12px;
        color: var(--brand);
        background: color-mix(in srgb, var(--brand) 14%, white);
      }
      @media (max-width: 860px) {
        .hero-grid, .section-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <section class="hero">
      <div class="shell">
        <div class="nav">
          <div class="brand">${preset.brandName}</div>
          <button class="cta">${preset.ctaText}</button>
        </div>
        <div class="hero-grid">
          <div class="headline">
            <div class="tag">${preset.category}</div>
            <h1>${preset.heroTitle}</h1>
            <p>${preset.heroSubtitle}</p>
          </div>
          <div class="stats">
            <div class="card"><strong>${preset.sortCode}</strong><span>模板编号</span></div>
            <div class="card"><strong>${preset.pageSpeedLabel}</strong><span>页面体验</span></div>
            <div class="card"><strong>${preset.rating.toFixed(1)} 分</strong><span>综合评分</span></div>
            <div class="card"><strong>${preset.ampReady ? "AMP" : "标准"}</strong><span>发布形态</span></div>
          </div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-grid">
        <div class="panel">
          <h3>产品模块</h3>
          <p>${preset.productTags.join(" / ") || "工业品、消费品、多场景产品展示"}</p>
        </div>
        <div class="panel">
          <h3>趋势模块</h3>
          <p>${preset.trendTags.join(" / ") || "科技感、信任感、国际化、多语言"}</p>
        </div>
        <div class="panel">
          <h3>支持模块</h3>
          <p>${preset.supportTags.join(" / ") || "AI 建站、SEO、询盘、客服、计划切换"}</p>
        </div>
      </div>
    </section>
  </body>
</html>`;
}

function buildPyroelkGeoB2BTemplate() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="description" content="PYROELK is a multilingual B2B industrial website template built for product discovery, factory proof and qualified buyer inquiries." />
  <meta name="robots" content="index,follow,max-image-preview:large" /><link rel="canonical" href="https://www.pyroelk.com/" />
  <meta property="og:type" content="website" /><meta property="og:title" content="PYROELK | Global B2B Growth Template" /><meta property="og:description" content="Industrial B2B template for global buyer discovery and qualified inquiries." /><meta property="og:image" content="https://www.pyroelk.com/og-pyroelk.png" />
  <link rel="alternate" hreflang="en" href="https://www.pyroelk.com/" /><link rel="alternate" hreflang="zh-CN" href="https://www.pyroelk.com/zh/" /><link rel="alternate" hreflang="de" href="https://www.pyroelk.com/de/" /><link rel="alternate" hreflang="es" href="https://www.pyroelk.com/es/" />
  <title>PYROELK | Industrial Solutions for Global Buyers</title>
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"PYROELK","url":"https://www.pyroelk.com/"},{"@type":"WebSite","name":"PYROELK Global","url":"https://www.pyroelk.com/","inLanguage":["en","zh-CN","de","es"]},{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Can I request OEM or custom specifications?","acceptedAnswer":{"@type":"Answer","text":"Yes. Share product, quantity, market and technical requirements through the inquiry form."}},{"@type":"Question","name":"Do you support multilingual documents?","acceptedAnswer":{"@type":"Answer","text":"Product documents, drawings and inquiry communication can be prepared for the selected market language."}}]}]}</script>
  <style>
  :root{--ink:#10231f;--muted:#63736d;--line:#d9e2df;--forest:#0c5c4d;--ember:#f26e45;--sand:#f5f1e8;--paper:#fffdfa}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);font-family:Inter,Arial,"PingFang SC",sans-serif;background:var(--paper);line-height:1.55}a{color:inherit;text-decoration:none}.shell{width:min(1180px,calc(100% - 40px));margin:auto}.top{background:var(--ink);color:#ecf4ef;font-size:12px}.top .shell{min-height:36px;display:flex;align-items:center;justify-content:space-between;gap:16px}.nav{position:sticky;top:0;z-index:20;background:#fffdfaeb;backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}.nav .shell{min-height:78px;display:flex;align-items:center;gap:20px}.brand{font-weight:900;letter-spacing:.13em;color:var(--forest);white-space:nowrap}.links{display:flex;align-items:center;gap:14px;flex:1;overflow:auto;font-size:13px;font-weight:700}.links a{white-space:nowrap}.nav-actions{display:flex;align-items:center;gap:8px}.lang,.ghost,.cta{border:1px solid var(--line);border-radius:999px;background:#fff;padding:10px 13px;font:inherit;font-size:12px;cursor:pointer}.cta{background:var(--ember);border-color:var(--ember);color:#fff;font-weight:800}.hero{padding:64px 0 48px;background:radial-gradient(circle at 85% 5%,#dceadf 0,transparent 31%),var(--sand)}.hero-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:38px;align-items:center}.eyebrow{display:inline-flex;border:1px solid #b9cec6;border-radius:999px;padding:7px 11px;color:var(--forest);font-size:12px;font-weight:800}.hero h1{font-size:clamp(42px,5.8vw,76px);line-height:1.02;letter-spacing:-.055em;margin:20px 0}.hero p{font-size:18px;color:#40534c;max-width:660px}.hero-actions,.proof{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}.proof{gap:16px;font-size:13px;font-weight:700}.proof span:before{content:"✓";color:var(--forest);margin-right:6px}.hero-visual{min-height:470px;border-radius:28px;overflow:hidden;background:#16453b;position:relative;box-shadow:0 28px 70px #10231f35}.hero-visual img{width:100%;height:100%;object-fit:cover;opacity:.7}.visual-card{position:absolute;left:24px;right:24px;bottom:24px;padding:18px;background:#fffdfae8;border:1px solid #fff;border-radius:18px}.visual-card strong{display:block;font-size:20px}.answer{padding:18px 0;border-bottom:1px solid var(--line);background:#fff}.answer .shell{display:flex;gap:16px}.answer b{color:var(--forest);white-space:nowrap}.section{padding:76px 0}.alt{background:#f7faf8}.section-head{display:flex;gap:20px;justify-content:space-between;align-items:end;margin-bottom:26px}.section h2{font-size:clamp(28px,3.4vw,46px);line-height:1.1;letter-spacing:-.04em;margin:0}.section-head p,.card p{margin:0;color:var(--muted)}.section-head p{max-width:520px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{border:1px solid var(--line);border-radius:18px;background:#fff;padding:22px}.card h3{margin:12px 0 8px;font-size:20px}.kicker{font-size:11px;font-weight:900;letter-spacing:.12em;color:var(--ember);text-transform:uppercase}.metric{font-size:36px;font-weight:900;color:var(--forest)}.split{display:grid;grid-template-columns:1fr 1fr;gap:24px}.checklist{list-style:none;padding:0;margin:20px 0}.checklist li{padding:11px 0;border-bottom:1px solid var(--line)}.checklist li:before{content:"→";color:var(--ember);font-weight:900;margin-right:10px}.form{border-radius:24px;padding:28px;background:var(--ink);color:#fff}.form h2{font-size:34px;margin:0}.form p{color:#c4d3cd}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}.form input,.form select,.form textarea{width:100%;border:1px solid #4b635b;border-radius:10px;padding:12px;background:#17362f;color:#fff;font:inherit}.form textarea{grid-column:1/-1;min-height:100px}.form .cta{width:100%;margin-top:12px}.fine{font-size:12px;color:#9fb5ad}.footer{padding:32px 0;background:#091a17;color:#d6e3dd}.footer .shell{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}@media(max-width:900px){.hero-grid,.split{grid-template-columns:1fr}.hero-visual{min-height:320px}.links{display:none}.grid,.form-grid{grid-template-columns:1fr}.top .shell{padding-block:8px}.nav .shell{min-height:64px}.section{padding:54px 0}}
  </style>
</head>
<body>
  <div class="top"><div class="shell"><span>Global B2B · OEM / ODM · Multilingual documentation</span><span>Reply target: within 1 business day</span></div></div>
  <header class="nav"><div class="shell"><a class="brand" href="#home">PYROELK</a><nav class="links" aria-label="Main navigation"><a href="#home">Home</a><a href="#products">Products</a><a href="#news">News</a><a href="#cases">Cases</a><a href="#videos">Videos</a><a href="#blog">Insights</a><a href="#company">Company</a><a href="#factory">Factory</a><a href="#gallery">Gallery</a><a href="#service">Service</a><a href="#faq">FAQ</a><a href="#exhibition">Exhibitions</a><a href="#logistics">Logistics</a><a href="#contact">Contact</a><a href="#im">IM Service</a></nav><div class="nav-actions"><select class="lang" aria-label="Language"><option>English</option><option>中文</option><option>Deutsch</option><option>Español</option></select><a class="cta" href="#contact">Request a quote</a></div></div></header>
  <main>
    <section id="home" class="hero"><div class="shell hero-grid"><div><span class="eyebrow">GEO / SEO / SEM-ready B2B template</span><h1>Make it easy for global buyers to choose you.</h1><p>High-trust product discovery, factory proof, market-language answers and a focused inquiry path—built for serious industrial procurement.</p><div class="hero-actions"><a class="cta" href="#contact">Start an inquiry</a><a class="ghost" href="#products">Explore solutions</a></div><div class="proof"><span>Structured buyer answers</span><span>Multi-site & multilingual</span><span>Lead-source ready</span></div></div><div class="hero-visual"><img src="https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1400&q=85" alt="Precision manufacturing line"/><div class="visual-card"><strong>From first question to qualified inquiry</strong><span>Products · evidence · applications · requirements · response owner</span></div></div></div></section>
    <section class="answer" data-geo-answer><div class="shell"><b>Buyer answer:</b><span>Share your product, quantity, destination market and technical requirements. The right specialist will return a documented solution, timeline and next step.</span></div></section>
    <section id="products" class="section"><div class="shell"><div class="section-head"><div><span class="kicker">Product center</span><h2>Clear categories. Faster comparison.</h2></div><p>Use the same product and category data from the customer source. Every product page supports search intent, specifications, use cases and a direct inquiry.</p></div><div class="grid"><article class="card"><span class="kicker">01 / Configure</span><h3>Modular production systems</h3><p>Capacity, material, controls and layout options for technical buyers.</p></article><article class="card"><span class="kicker">02 / Prove</span><h3>Quality-critical equipment</h3><p>Certificates, inspection process, commissioning and service evidence.</p></article><article class="card"><span class="kicker">03 / Convert</span><h3>OEM / custom projects</h3><p>Drawings, quantity, target country and delivery window captured in one form.</p></article></div></div></section>
    <section id="cases" class="section alt"><div class="shell split"><div><span class="kicker">Evidence before promise</span><h2>Content that answers procurement questions.</h2><ul class="checklist"><li id="news">News and market updates for the buyer's industry</li><li id="videos">Factory and product videos for remote evaluation</li><li id="blog">Expert articles designed for topic authority and AI search answers</li><li id="gallery">Workshop, showroom and team proof</li></ul></div><div class="card"><span class="kicker">GEO content model</span><div class="metric">3 layers</div><p>Answer-first summaries, source-backed detail and conversion CTA. This supports search, AI answer engines and paid landing-page traffic without duplicate content.</p><div class="proof"><span>Schema-ready FAQ</span><span>Hreflang path</span><span>UTM lead capture</span></div></div></div></section>
    <section id="company" class="section"><div class="shell split"><div><span class="kicker">About us</span><h2>Brand, company, service and contact—one source of truth.</h2><p>Basic profile, custom modules, company introduction, factory production, service assurance and contact information are managed from the customer source and released by version to each plan.</p></div><div class="grid"><div class="card"><span class="kicker">Factory</span><h3 id="factory">Production proof</h3><p>Capacity, quality checkpoints and export packaging.</p></div><div class="card"><span class="kicker">Service</span><h3 id="service">Response path</h3><p>Pre-sales, commissioning, spare parts and lifecycle support.</p></div><div class="card"><span class="kicker">Exhibition</span><h3 id="exhibition">Meet buyers</h3><p>Event schedule, appointments and post-show follow-up.</p></div></div></div></section>
    <section id="faq" class="section alt"><div class="shell"><div class="section-head"><div><span class="kicker">FAQ</span><h2>Give buyers confident next steps.</h2></div><p>FAQ items synchronize with the customer source and are surfaced as readable answer blocks, not hidden marketing copy.</p></div><div class="grid"><article class="card"><h3>Can you support OEM / ODM?</h3><p>Yes. Submit drawings, standards, quantity and target market for review.</p></article><article class="card"><h3>Which languages are available?</h3><p>English, Chinese, German and Spanish are enabled by default; add language packs by site.</p></article><article class="card"><h3>How is shipping handled?</h3><p id="logistics">Sea, air, rail and courier options are scoped to destination and delivery window.</p></article></div></div></section>
    <section id="contact" class="section"><div class="shell form"><span class="kicker" style="color:#ffb59c">Qualified inquiry</span><h2>Tell us what you need. We will route it correctly.</h2><p>Short form, clear fields, multilingual context and source tracking for the sales team.</p><form id="sem-lead-form"><div class="form-grid"><input name="name" required placeholder="Your name"/><input name="company" required placeholder="Company name"/><input name="email" type="email" required placeholder="Business email"/><select name="market"><option>Target market / country</option><option>Europe</option><option>North America</option><option>Middle East</option><option>Latin America</option></select><textarea name="requirements" required placeholder="Product, application, quantity, technical standard, timeline and shipping needs"></textarea></div><input type="hidden" name="utm_source"/><input type="hidden" name="utm_campaign"/><button class="cta" type="submit">Send inquiry</button><p class="fine">By submitting, you agree that PYROELK may use these details only to respond to this business inquiry.</p><p id="form-status" class="fine" role="status"></p></form></div></section>
  </main>
  <footer id="im" class="footer"><div class="shell"><div><strong>PYROELK</strong><div>Let growth move faster. Let operations stay lighter.</div></div><div>IM service · WhatsApp · Email · LinkedIn<br/>Multi-site version release · multilingual content pack</div></div></footer>
  <script>const params=new URLSearchParams(location.search);const form=document.getElementById("sem-lead-form");form.utm_source.value=params.get("utm_source")||"direct";form.utm_campaign.value=params.get("utm_campaign")||"organic";form.addEventListener("submit",function(event){event.preventDefault();document.getElementById("form-status").textContent="Thank you. Your inquiry is ready for the assigned sales response workflow.";});</script>
</body></html>`;
}

const basePresets: WebsiteTemplatePreset[] = [
  {
    id: "pyroelk-geo-b2b",
    name: "PYROELK 全球采购增长版",
    category: "高端外贸 B2B",
    summary: "面向海外采购商的多语言工业官网：产品发现、工厂证据、GEO/SEO 内容与 SEM 询盘转化同一条路径。",
    brandName: "PYROELK",
    heroTitle: "Make it easy for global buyers to choose you.",
    heroSubtitle: "高信任产品发现、工厂证据、市场语言答案与询盘表单，服务海外 B2B 采购决策。",
    ctaText: "Request a quote",
    primaryColor: "#0C5C4D",
    layoutVariant: "showcase",
    preview: "gradient-emerald",
    sortCode: "GEO-01",
    productTags: ["工业设备", "OEM / ODM", "海外采购"],
    trendTags: ["GEO 答案优先", "SEO 结构化数据", "SEM 询盘转化"],
    supportTags: ["多站点", "多语言", "版本发布", "IM 客服"],
    notes: "客户源模板：导航、基本资料、首页大图、产品推荐、关于我们、服务保障、联系我们、FAQ 与 IM 均读取现有内容库；应用后创建计划草稿，不覆盖已发布站点。",
    pageSpeedLabel: "Core Web Vitals 就绪",
    ampReady: true,
    pricingTier: "paid",
    rating: 5,
    uses: 0,
    thumbnail: "🌍",
    html: "",
    pages: ["首页", "产品中心", "新闻中心", "工程案例", "企业视频", "博客中心", "公司介绍", "工厂生产", "公司风采", "服务保障", "FAQ", "展会活动", "物流货运", "联系我们", "IM 客服"],
    industry: "工业制造 / 自动化 / 外贸 B2B",
    languages: ["English", "中文", "Deutsch", "Español"],
    marketingCapabilities: ["GEO", "SEO", "SEM", "询盘归因", "结构化数据"],
    contentSyncSources: ["首页设计 → 导航自定", "首页设计 → 首页大图", "首页设计 → 产品推荐", "企业资料 → 基本资料 / 自定模块 / 关于我们 / 服务保障 / 联系我们", "产品管理 → 产品列表 / 分类管理", "内容管理 → 新闻 / 案例 / 视频 / 博客"],
  },
  {
    id: "trade-green",
    name: "薄荷绿工业版",
    category: "工业",
    summary: "适合工业品与设备类站点，首页重点突出产品矩阵和交付能力。",
    brandName: "TradeMint",
    heroTitle: "面向海外采购商的薄荷绿工业站点",
    heroSubtitle: "强调产品分类、交付流程、认证资质与询盘转化，适合外贸工厂与 B2B 出海品牌。",
    ctaText: "立即获取报价",
    primaryColor: "#44D97A",
    layoutVariant: "catalog",
    preview: "gradient-emerald",
    sortCode: "G-01",
    productTags: ["工业制造", "设备配件", "多规格产品"],
    trendTags: ["科技感", "清爽浅色", "品牌信任"],
    supportTags: ["AI 建站", "SEO 布局", "询盘转化"],
    notes: "默认工业站点模板。",
    pageSpeedLabel: "高分优化",
    ampReady: true,
    pricingTier: "free",
    rating: 4.9,
    uses: 3280,
    thumbnail: "🟢",
    html: "",
  },
  {
    id: "trade-rose",
    name: "玫红时尚版",
    category: "消费",
    summary: "适合轻奢、饰品、美妆和潮流类客户，视觉识别度高。",
    brandName: "RoseLine",
    heroTitle: "高辨识度的玫红外贸品牌站",
    heroSubtitle: "聚焦品牌故事、爆品展示和社媒扩散，适合想要更强视觉记忆点的客户。",
    ctaText: "预约样品",
    primaryColor: "#D9487C",
    layoutVariant: "showcase",
    preview: "gradient-rose",
    sortCode: "R-02",
    productTags: ["饰品箱包", "美妆个护", "潮流消费"],
    trendTags: ["强视觉", "品牌感", "社媒转化"],
    supportTags: ["多语言", "品牌页", "客服入口"],
    notes: "高识别度品牌模板。",
    pageSpeedLabel: "高分优化",
    ampReady: true,
    pricingTier: "paid",
    rating: 4.8,
    uses: 1680,
    thumbnail: "🌹",
    html: "",
  },
  {
    id: "trade-orange",
    name: "活力橙转化版",
    category: "营销",
    summary: "适合招商、促销和活动驱动型站点，突出行动按钮与优惠区块。",
    brandName: "OrangeFlow",
    heroTitle: "把询盘与转化放在第一位的活力橙站点",
    heroSubtitle: "更适合活动促销、招商加盟、重点 SKU 推广等高转化场景。",
    ctaText: "获取方案",
    primaryColor: "#F77900",
    layoutVariant: "summit",
    preview: "gradient-amber",
    sortCode: "O-03",
    productTags: ["招商项目", "促销活动", "重点 SKU"],
    trendTags: ["高转化", "强按钮", "运营导向"],
    supportTags: ["线索收集", "AI 客服", "计划切换"],
    notes: "转化优先模板。",
    pageSpeedLabel: "极速加载",
    ampReady: true,
    pricingTier: "free",
    rating: 4.8,
    uses: 2140,
    thumbnail: "🟠",
    html: "",
  },
  {
    id: "trade-cyan",
    name: "亮青科技版",
    category: "科技",
    summary: "适合软件、SaaS、AI、数据和智能硬件，强调科技感与模块秩序。",
    brandName: "AquaGrid",
    heroTitle: "更适合 AI / SaaS / 智能硬件的亮青色科技模板",
    heroSubtitle: "突出能力模块、产品方案、技术卖点与案例结构，适合高科技行业出海展示。",
    ctaText: "查看方案",
    primaryColor: "#1EBEF0",
    layoutVariant: "showcase",
    preview: "gradient-sky",
    sortCode: "B-04",
    productTags: ["AI 软件", "SaaS 服务", "智能硬件"],
    trendTags: ["科技感", "模块秩序", "数据表达"],
    supportTags: ["多计划", "模板联动", "智能客服"],
    notes: "科技感模板。",
    pageSpeedLabel: "高分优化",
    ampReady: true,
    pricingTier: "paid",
    rating: 5,
    uses: 2450,
    thumbnail: "🔵",
    html: "",
  },
  {
    id: "trade-dark",
    name: "黑深灰专业版",
    category: "企业",
    summary: "适合集团企业、解决方案商和专业后台展示，整体更稳重。",
    brandName: "BlackStone",
    heroTitle: "更适合集团与专业方案商的黑深灰站点",
    heroSubtitle: "适合展示复杂服务体系、企业能力、项目流程与行业标准，视觉稳重且专业。",
    ctaText: "联系顾问",
    primaryColor: "#3A3C43",
    layoutVariant: "catalog",
    preview: "gradient-slate",
    sortCode: "K-05",
    productTags: ["企业服务", "解决方案", "系统项目"],
    trendTags: ["专业后台", "高对比", "稳重可信"],
    supportTags: ["角色协同", "总站同步", "版本管理"],
    notes: "专业方案模板。",
    pageSpeedLabel: "稳定优化",
    ampReady: false,
    pricingTier: "free",
    rating: 4.7,
    uses: 1960,
    thumbnail: "⚫",
    html: "",
  },
  {
    id: "trade-pink",
    name: "浅粉品牌版",
    category: "品牌",
    summary: "适合品牌型客户与轻内容站点，整体更柔和，更突出品牌形象。",
    brandName: "PinkHarbor",
    heroTitle: "面向品牌塑造与轻内容展示的浅粉模板",
    heroSubtitle: "适合展示品牌理念、主视觉、案例与社交媒体延展，整体更柔和但保持专业感。",
    ctaText: "了解品牌",
    primaryColor: "#B78F92",
    layoutVariant: "summit",
    preview: "gradient-blue",
    sortCode: "L-06",
    productTags: ["品牌展示", "轻内容站", "案例故事"],
    trendTags: ["柔和配色", "品牌叙事", "轻奢气质"],
    supportTags: ["内容管理", "多语言", "模板中心"],
    notes: "柔和品牌模板。",
    pageSpeedLabel: "高分优化",
    ampReady: true,
    pricingTier: "paid",
    rating: 4.8,
    uses: 1520,
    thumbnail: "🩷",
    html: "",
  },
];

const defaultPresets = basePresets.map((item) => ({
  ...item,
  html: item.html || (item.id === "pyroelk-geo-b2b" ? buildPyroelkGeoB2BTemplate() : buildTemplateHtml(item)),
}));

function clonePreset(preset: WebsiteTemplatePreset): WebsiteTemplatePreset {
  return {
    ...preset,
    productTags: [...preset.productTags],
    trendTags: [...preset.trendTags],
    supportTags: [...preset.supportTags],
    pages: preset.pages ? [...preset.pages] : undefined,
    languages: preset.languages ? [...preset.languages] : undefined,
    marketingCapabilities: preset.marketingCapabilities ? [...preset.marketingCapabilities] : undefined,
    contentSyncSources: preset.contentSyncSources ? [...preset.contentSyncSources] : undefined,
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStoredPresets() {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WebsiteTemplatePreset[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredPresets(presets: WebsiteTemplatePreset[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

function normalizePreset(preset: Partial<WebsiteTemplatePreset>, fallback: WebsiteTemplatePreset) {
  const merged: WebsiteTemplatePreset = {
    ...fallback,
    ...preset,
    productTags: Array.isArray(preset.productTags) ? preset.productTags.filter(Boolean) : [...fallback.productTags],
    trendTags: Array.isArray(preset.trendTags) ? preset.trendTags.filter(Boolean) : [...fallback.trendTags],
    supportTags: Array.isArray(preset.supportTags) ? preset.supportTags.filter(Boolean) : [...fallback.supportTags],
  };
  merged.html = merged.html || buildTemplateHtml(merged);
  return merged;
}

export const defaultWebsiteTemplatePreset = clonePreset(defaultPresets[0]);

export function getWebsiteTemplatePresets() {
  const stored = readStoredPresets();
  if (!stored?.length) {
    return defaultPresets.map(clonePreset);
  }
  const fallbackMap = new Map(defaultPresets.map((preset) => [preset.id, preset]));
  const storedPresets = stored.map((preset, index) => {
    const fallback = fallbackMap.get(preset.id) || defaultPresets[index] || defaultWebsiteTemplatePreset;
    return normalizePreset(preset, fallback);
  });
  const storedIds = new Set(storedPresets.map((preset) => preset.id));
  return [...defaultPresets.filter((preset) => !storedIds.has(preset.id)).map(clonePreset), ...storedPresets];
}

export function getWebsiteTemplatePresetById(id?: string | null) {
  if (!id) return defaultWebsiteTemplatePreset;
  return getWebsiteTemplatePresets().find((preset) => preset.id === id) || defaultWebsiteTemplatePreset;
}

export function getTemplateModuleCode(template: WebsiteTemplatePreset) {
  return template.sortCode || template.id.toUpperCase();
}

export function updateWebsiteTemplatePresetMeta(
  id: string,
  patch: Partial<
    Pick<
      WebsiteTemplatePreset,
      "sortCode" | "productTags" | "trendTags" | "supportTags" | "notes" | "pageSpeedLabel" | "ampReady" | "pricingTier" | "name"
    >
  >
) {
  const current = getWebsiteTemplatePresets();
  const next = current.map((preset) =>
    preset.id === id
      ? normalizePreset(
          {
            ...preset,
            ...patch,
          },
          preset
        )
      : preset
  );
  writeStoredPresets(next);
}
