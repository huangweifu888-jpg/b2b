import { defaultWebsiteTemplatePreset, type WebsiteTemplatePreset } from "@website-style/website-template-presets";
import { applyWebsiteContentToBuilderState } from "./website-content-builder";
import { getDefaultTemplateLanguages, SUPPORTED_LANGUAGES, type SupportedLanguage } from "./ai-builder-scope";
import { sanitizeDisplayText } from "./text-sanitizer";
import { ALL_CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS } from "./customer-service-reminder-sound";
import { CUSTOMER_SERVICE_VOICE_PRESETS } from "./customer-service-voice";

export type LanguageKey = SupportedLanguage;

export type TranslationMap = Record<LanguageKey, string>;

export type BlockType =
  | "hero"
  | "products"
  | "company"
  | "cases"
  | "news"
  | "videos"
  | "blog"
  | "social"
  | "faq"
  | "factory"
  | "gallery"
  | "exhibition"
  | "service"
  | "logistics"
  | "im"
  | "contact"
  | "testimonials";

export type BlockAnimation = "none" | "fade-up" | "zoom-in";

export type SiteBlockItem = {
  id: string;
  title: TranslationMap;
  body: TranslationMap;
  image?: string;
  value?: string;
  link?: string;
};

export type SiteBlock = {
  id: string;
  type: BlockType;
  visible: boolean;
  title: TranslationMap;
  subtitle: TranslationMap;
  body?: TranslationMap;
  ctaText?: TranslationMap;
  ctaLink?: string;
  image?: string;
  items: SiteBlockItem[];
  style: {
    bgColor: string;
    textColor: string;
    titleColor: string;
    accentColor: string;
    fontScale: number;
    borderRadius: number;
    animation: BlockAnimation;
  };
};

export type SiteTheme = {
  primaryColor: string;
  secondaryColor: string;
  canvasColor: string;
  surfaceColor: string;
  mutedColor: string;
  fontFamily: string;
};

export type SiteNavigationItem = {
  id: string;
  label: string;
  iconName?: string;
  customIconUrl?: string;
  customIconAssetId?: string;
  sectionKey?: string;
  href: string;
  visible: boolean;
  children?: SiteNavigationItem[];
};

export type PublishedCustomerServiceConfig = {
  enabled: boolean;
  avatarId: string;
  avatarName: string;
  avatarStyle: "professional" | "friendly" | "cute" | "tech" | "elegant" | "strong";
  avatarColor: string;
  greeting: string;
  animationStyle: "pulse" | "float" | "bounce" | "glow" | "flip-roll" | "spin-slow" | "breathe" | "sway" | "heartbeat" | "wobble" | "wave" | "tilt";
  soundEnabled: boolean;
  soundVolume: number;
  soundStyle: string;
  voiceEnabled: boolean;
  voiceGender: "female" | "male";
  voiceRate: number;
  voiceStyleKey?: string;
  mediaDataUrl?: string;
  mediaKind?: "image" | "video";
  mediaMimeType?: string;
  reminderSoundDataUrl?: string;
  reminderSoundMimeType?: string;
  uploadedVoiceDataUrl?: string;
  uploadedVoiceMimeType?: string;
  launcherLabel?: string;
  panelTitle?: string;
  inputPlaceholder?: string;
  sendLabel?: string;
};

export type SiteBuilderState = {
  templateId: string;
  templateName: string;
  layoutVariant: "summit" | "catalog" | "showcase";
  siteName: string;
  brandName: string;
  companyEnglishName?: string;
  industry: string;
  activeLanguage: LanguageKey;
  languages: LanguageKey[];
  theme: SiteTheme;
  homepageTitle?: string;
  logoUrl?: string;
  logoAlt?: string;
  faviconUrl?: string;
  footerCopyright?: string;
  brandType?: string;
  contact: {
    email: string;
    phone: string;
    address: string;
    whatsapp: string;
    website: string;
    contactPerson?: string;
    fax?: string;
  };
  blocks: SiteBlock[];
  navigation?: {
    enabled: boolean;
    items: SiteNavigationItem[];
    ctaLabel: string;
    ctaHref: string;
  };
  customerService?: PublishedCustomerServiceConfig;
};

const DEFAULT_LANGUAGES: LanguageKey[] = [...getDefaultTemplateLanguages()];
const ALL_LANGUAGES: LanguageKey[] = SUPPORTED_LANGUAGES.map((item) => item.key);

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function tx(en: string, zh?: string, es?: string, de?: string): TranslationMap {
  const base = sanitizeDisplayText(en, en || "");
  const cleanZh = sanitizeDisplayText(zh, base);
  const cleanEs = sanitizeDisplayText(es, base);
  const cleanDe = sanitizeDisplayText(de, base);
  const map = {} as TranslationMap;
  ALL_LANGUAGES.forEach((lang) => {
    map[lang] = base;
  });
  map.zh = cleanZh;
  map["zh-tw"] = cleanZh;
  map.es = cleanEs;
  map.de = cleanDe;
  return map;
}

function blockBase(type: BlockType, title: TranslationMap, subtitle: TranslationMap, options?: Partial<SiteBlock>): SiteBlock {
  return {
    id: uid(type),
    type,
    visible: true,
    title,
    subtitle,
    body: options?.body,
    ctaText: options?.ctaText,
    ctaLink: options?.ctaLink || "#contact",
    image: options?.image,
    items: options?.items || [],
    style: {
      bgColor: options?.style?.bgColor || "#ffffff",
      textColor: options?.style?.textColor || "#475569",
      titleColor: options?.style?.titleColor || "#0f172a",
      accentColor: options?.style?.accentColor || "#2563eb",
      fontScale: options?.style?.fontScale || 1,
      borderRadius: options?.style?.borderRadius || 24,
      animation: options?.style?.animation || "fade-up",
    },
  };
}

export function getBlockTypeLabel(type: BlockType) {
  const cleanLabels: Record<BlockType, string> = {
    hero: "首页 Hero",
    products: "产品中心",
    company: "公司介绍",
    cases: "工程案例",
    news: "新闻中心",
    videos: "企业视频",
    blog: "博客中心",
    social: "社交媒体",
    faq: "FAQ",
    factory: "工厂生产",
    gallery: "公司风采",
    exhibition: "展会活动",
    service: "服务保障",
    logistics: "物流货运",
    im: "IM 客服插件",
    contact: "联系询盘",
    testimonials: "客户评价",
  };
  return cleanLabels[type];
  return {
    hero: "首页 Hero",
    products: "产品中心",
    company: "公司介绍",
    cases: "工程案例",
    news: "新闻中心",
    blog: "博客中心",
    social: "社交媒体",
    faq: "FAQ",
    factory: "工厂生产",
    gallery: "公司风采",
    exhibition: "展会活动",
    service: "服务保障",
    logistics: "物流货运",
    im: "IM 客服插件",
    contact: "联系询盘",
    testimonials: "客户评价",
  }[type];
}

export function createBlockByType(type: BlockType, accent = "#2563eb"): SiteBlock {
  switch (type) {
    case "hero":
      return blockBase(
        "hero",
        tx(
          "Build a multilingual machinery website that converts buyers",
          "打造能转化海外买家的多语言机械网站",
          "Crea un sitio multilingüe de maquinaria que convierta compradores",
          "Erstelle eine mehrsprachige Maschinenbau-Website mit hoher Conversion"
        ),
        tx(
          "Responsive editing, plugin modules, multilingual switching, and direct publishing.",
          "支持响应式编辑、插件模块、多语言切换和直接发布。",
          "Edición responsive, módulos plugin, cambio multilingüe y publicación directa.",
          "Responsives Editing, Plugin-Module, Sprachumschaltung und Direktveröffentlichung."
        ),
        {
          body: tx(
            "Designed for B2B exporters with product pages, factory proof, project cases, blogs, and inquiry capture.",
            "面向 B2B 外贸出口，覆盖产品页、工厂实力、案例、博客与询盘转化。",
            "Diseñado para exportadores B2B con productos, fábrica, casos, blog y captación de consultas.",
            "Für B2B-Exporteure mit Produktseiten, Fabrikstärke, Referenzen, Blog und Lead-Erfassung."
          ),
          ctaText: tx("Get Catalog", "获取目录", "Obtener catálogo", "Katalog anfordern"),
          image: "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&w=1600&q=80",
          items: [
            { id: uid("stat"), title: tx("30+", "30+", "30+", "30+"), body: tx("Export Countries", "出口国家", "Países de exportación", "Exportländer"), value: "30+" },
            { id: uid("stat"), title: tx("12h", "12小时", "12h", "12 Std."), body: tx("Fast Quote", "快速报价", "Cotización rápida", "Schnelles Angebot"), value: "12h" },
            { id: uid("stat"), title: tx("OEM", "OEM", "OEM", "OEM"), body: tx("Custom Service", "定制服务", "Servicio personalizado", "Kundenspezifischer Service"), value: "OEM" },
          ],
          style: {
            bgColor: "#0f172a",
            textColor: "#cbd5e1",
            titleColor: "#ffffff",
            accentColor: accent,
            fontScale: 1,
            borderRadius: 32,
            animation: "fade-up",
          },
        }
      );
    case "products":
      return blockBase(
        "products",
        tx("Product Center", "产品中心", "Centro de productos", "Produktzentrum"),
        tx(
          "Configurable cards for product categories, specs, and inquiry conversion.",
          "可配置产品卡片，支持分类、参数和询盘转化。",
          "Tarjetas configurables para categorías, especificaciones y conversión.",
          "Konfigurierbare Produktkarten für Kategorien, Daten und Leads."
        ),
        {
          items: [
            {
              id: uid("product"),
              title: tx("CNC Machining Line", "CNC 加工产线", "Línea CNC", "CNC-Bearbeitungslinie"),
              body: tx("Automation, drawings, and multilingual datasheets.", "自动化、图纸与多语言资料。", "Automatización, planos y fichas multilingües.", "Automatisierung, Zeichnungen und mehrsprachige Datenblätter."),
              image: "https://images.unsplash.com/photo-1567789884554-0b844b597180?auto=format&fit=crop&w=1200&q=80",
            },
            {
              id: uid("product"),
              title: tx("Packaging Machinery", "包装机械", "Maquinaria de empaque", "Verpackungsmaschinen"),
              body: tx("OEM-ready for global distributors and factories.", "面向全球代理与工厂的 OEM 方案。", "Listo para OEM y distribuidores globales.", "OEM-fähig für globale Händler und Werke."),
              image: "https://images.unsplash.com/photo-1581092160607-ee22731d8b68?auto=format&fit=crop&w=1200&q=80",
            },
            {
              id: uid("product"),
              title: tx("Assembly Automation", "装配自动化", "Automatización de ensamblaje", "Montageautomatisierung"),
              body: tx("Remote support, spare parts, and startup guidance.", "远程支持、备件与投产指导。", "Soporte remoto, repuestos y puesta en marcha.", "Remote-Support, Ersatzteile und Inbetriebnahme."),
              image: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80",
            },
          ],
          style: { bgColor: "#f8fafc", textColor: "#475569", titleColor: "#0f172a", accentColor: accent, fontScale: 1, borderRadius: 24, animation: "fade-up" },
        }
      );
    case "company":
      return blockBase(
        "company",
        tx("Company Profile", "公司介绍", "Perfil de la empresa", "Unternehmensprofil"),
        tx(
          "Factory strength, enterprise story, team and certification proof.",
          "展示工厂实力、企业故事、团队与认证资质。",
          "Muestra fábrica, historia, equipo y certificaciones.",
          "Zeigt Fabrikstärke, Story, Team und Zertifizierungen."
        ),
        {
          body: tx(
            "Perfect for building trust with overseas buyers through image-text sections and capacity highlights.",
            "通过图文模块和产能亮点增强海外买家信任。",
            "Ideal para ganar confianza con secciones visuales y capacidad productiva.",
            "Perfekt für Vertrauen durch Bild-Text-Module und Kapazitätsnachweise."
          ),
          image: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80",
          items: [
            { id: uid("company"), title: tx("Factory Production", "工厂生产", "Producción", "Fabrikproduktion"), body: tx("CNC, assembly, QA and packaging workflow.", "CNC、装配、质检和包装流程。", "CNC, ensamblaje, QA y empaque.", "CNC, Montage, QA und Verpackung.") },
            { id: uid("company"), title: tx("Company Gallery", "公司风采", "Galería", "Unternehmensgalerie"), body: tx("Office, workshop, showroom and team profile.", "办公区、车间、展厅与团队风采。", "Oficina, taller, showroom y equipo.", "Büro, Werkstatt, Showroom und Team.") },
          ],
          style: { bgColor: "#ffffff", textColor: "#475569", titleColor: "#0f172a", accentColor: accent, fontScale: 1, borderRadius: 24, animation: "fade-up" },
        }
      );
    case "cases":
      return blockBase(
        "cases",
        tx("Project Cases", "工程案例", "Casos de proyecto", "Projektfälle"),
        tx("Show engineering references and buyer success stories.", "展示工程项目与客户成功案例。", "Muestra referencias y casos de éxito.", "Zeigt Referenzen und Kundenerfolge."),
        {
          items: [
            { id: uid("case"), title: tx("Automotive Plant", "汽车零部件工厂", "Planta automotriz", "Automobilwerk"), body: tx("Turnkey delivery with bilingual manuals and FAT video.", "交钥匙交付，含双语手册和 FAT 视频。", "Entrega llave en mano con manuales bilingües.", "Schlüsselfertige Lieferung mit zweisprachigen Handbüchern.") },
            { id: uid("case"), title: tx("Metal Fabrication Workshop", "金属加工车间", "Taller metalmecánico", "Metallbearbeitung"), body: tx("Installed with remote training and spare parts plan.", "配套远程培训与备件计划。", "Instalado con capacitación remota y repuestos.", "Mit Remote-Training und Ersatzteilplan installiert.") },
          ],
          style: { bgColor: "#0f172a", textColor: "#cbd5e1", titleColor: "#ffffff", accentColor: accent, fontScale: 1, borderRadius: 24, animation: "zoom-in" },
        }
      );
    case "news":
      return blockBase(
        "news",
        tx("News Center", "新闻中心", "Centro de noticias", "News Center"),
        tx("Corporate updates, factory news, and event release.", "企业动态、工厂新闻和活动发布。", "Actualizaciones corporativas y noticias de fábrica.", "Unternehmensupdates und Fabriknews."),
        {
          items: [
            { id: uid("news"), title: tx("Factory expansion completed", "新车间已投产", "Expansión de fábrica completada", "Werksausbau abgeschlossen"), body: tx("Production capacity and delivery speed improved.", "产能与交付速度进一步提升。", "Mejora de capacidad y entrega.", "Kapazität und Liefergeschwindigkeit verbessert.") },
            { id: uid("news"), title: tx("Trade fair schedule released", "展会计划已发布", "Calendario de ferias publicado", "Messetermine veröffentlicht"), body: tx("Ready for overseas buyer appointment booking.", "可供海外买家预约洽谈。", "Listo para citas con compradores.", "Bereit für Käufertermine.") },
          ],
          style: { bgColor: "#ffffff", textColor: "#475569", titleColor: "#0f172a", accentColor: accent, fontScale: 1, borderRadius: 20, animation: "fade-up" },
        }
      );
    case "videos":
      return blockBase(
        "videos",
        tx("Company Videos", "企业视频", "Vídeos corporativos", "Unternehmensvideos"),
        tx("Factory tours, product demonstrations, and buyer-facing technical proof.", "展示工厂参观、产品演示与采购商需要的技术证明。", "Recorridos de fábrica, demostraciones y pruebas técnicas.", "Werksrundgänge, Produktdemos und technische Nachweise."),
        {
          items: [
            { id: uid("video"), title: tx("Factory capability overview", "工厂实力概览", "Resumen de capacidad", "Überblick der Fertigung"), body: tx("Production, quality inspection, packing, and export readiness.", "生产、质检、包装与出口准备。", "Producción, calidad, embalaje y exportación.", "Produktion, QS, Verpackung und Export."), image: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=80" },
            { id: uid("video"), title: tx("Product demonstration", "产品演示", "Demostración de producto", "Produktdemonstration"), body: tx("Show core workflow, configuration, and application results.", "展示核心流程、配置与应用效果。", "Muestra proceso, configuración y resultados.", "Zeigt Ablauf, Konfiguration und Ergebnisse."), image: "https://images.unsplash.com/photo-1567789884554-0b844b597180?auto=format&fit=crop&w=1200&q=80" },
          ],
          style: { bgColor: "#f8fafc", textColor: "#475569", titleColor: "#0f172a", accentColor: accent, fontScale: 1, borderRadius: 20, animation: "zoom-in" },
        }
      );
    case "blog":
      return blockBase(
        "blog",
        tx("Blog Center", "博客中心", "Centro de blog", "Blog Center"),
        tx("SEO content, purchasing guides, and logistics knowledge.", "SEO 内容、采购指南与物流知识。", "Contenido SEO, guías de compra y logística.", "SEO-Inhalte, Einkaufsleitfäden und Logistik."),
        {
          items: [
            { id: uid("blog"), title: tx("How to choose the right machinery line", "如何选择合适的机械产线", "Cómo elegir la línea adecuada", "Wie man die richtige Anlage auswählt"), body: tx("Useful for inquiry conversion and organic traffic.", "适合询盘转化与自然流量。", "Útil para SEO y conversiones.", "Hilfreich für SEO und Leads.") },
            { id: uid("blog"), title: tx("Freight and Incoterm checklist", "货运与条款清单", "Checklist de flete e Incoterms", "Checkliste für Fracht und Incoterms"), body: tx("Perfect for buyers comparing delivery solutions.", "适合买家做物流方案对比。", "Ideal para comparar soluciones logísticas.", "Ideal für Logistikvergleiche.") },
          ],
          style: { bgColor: "#f8fafc", textColor: "#475569", titleColor: "#0f172a", accentColor: accent, fontScale: 1, borderRadius: 20, animation: "fade-up" },
        }
      );
    case "social":
      return blockBase(
        "social",
        tx("Social Media", "社交媒体", "Redes sociales", "Social Media"),
        tx("Keep LinkedIn, YouTube, Facebook, and X visible for buyers.", "让 LinkedIn、YouTube、Facebook、X 等渠道持续曝光。", "Mantén visibles LinkedIn, YouTube, Facebook y X.", "Halte LinkedIn, YouTube, Facebook und X sichtbar."),
        {
          items: [
            { id: uid("social"), title: tx("LinkedIn", "LinkedIn", "LinkedIn", "LinkedIn"), body: tx("Company updates and B2B networking", "企业动态与 B2B 社交", "Actualizaciones y networking B2B", "Unternehmensnews und B2B-Netzwerk"), link: "https://linkedin.com" },
            { id: uid("social"), title: tx("YouTube", "YouTube", "YouTube", "YouTube"), body: tx("Factory tour and product demo", "工厂参观与产品演示", "Tour de fábrica y demos", "Fabrikrundgang und Demos"), link: "https://youtube.com" },
            { id: uid("social"), title: tx("Facebook", "Facebook", "Facebook", "Facebook"), body: tx("Campaign and trade show highlights", "活动与展会亮点", "Campañas y ferias", "Kampagnen und Messe-Highlights"), link: "https://facebook.com" },
          ],
          style: { bgColor: "#0f172a", textColor: "#cbd5e1", titleColor: "#ffffff", accentColor: accent, fontScale: 1, borderRadius: 20, animation: "zoom-in" },
        }
      );
    case "faq":
      return blockBase(
        "faq",
        tx("FAQ", "FAQ", "FAQ", "FAQ"),
        tx("Answer the common buyer questions clearly.", "清晰解答买家常见问题。", "Responde preguntas frecuentes del comprador.", "Beantworte häufige Käuferfragen klar."),
        {
          items: [
            { id: uid("faq"), title: tx("Do you support OEM and multilingual branding?", "是否支持 OEM 与多语言品牌定制？", "¿Admiten OEM y marca multilingüe?", "Unterstützen Sie OEM und mehrsprachiges Branding?"), body: tx("Yes. Product labels, UI copy, and catalog content can all be localized.", "支持，产品标签、界面文案和目录内容均可本地化。", "Sí. Etiquetas, interfaz y catálogos se pueden localizar.", "Ja. Etiketten, UI-Texte und Kataloge können lokalisiert werden.") },
            { id: uid("faq"), title: tx("How do you handle after-sales support?", "售后支持如何处理？", "¿Cómo gestionan el servicio postventa?", "Wie läuft der After-Sales-Service?"), body: tx("Remote support, manuals, parts, and service guarantee can be embedded into the website.", "支持远程协助、手册、备件与服务保障模块。", "Soporte remoto, manuales, repuestos y garantía integrados.", "Remote-Support, Handbücher, Teile und Servicegarantie integriert.") },
          ],
          style: { bgColor: "#ffffff", textColor: "#475569", titleColor: "#0f172a", accentColor: accent, fontScale: 1, borderRadius: 18, animation: "fade-up" },
        }
      );
    case "factory":
      return blockBase(
        "factory",
        tx("Factory Production", "工厂生产", "Producción de fábrica", "Fabrikproduktion"),
        tx("Show workshop lines, QA, and production capacity.", "展示生产线、质检与产能实力。", "Muestra líneas de producción y QA.", "Zeigt Produktionslinien und QA."),
        {
          items: [
            { id: uid("factory"), title: tx("CNC Zone", "CNC 区", "Zona CNC", "CNC-Zone"), body: tx("Precision machining and process control.", "精密加工与过程控制。", "Mecanizado preciso y control.", "Präzisionsbearbeitung und Kontrolle.") },
            { id: uid("factory"), title: tx("Assembly Line", "装配线", "Línea de ensamblaje", "Montagelinie"), body: tx("Flexible assembly for multi-market orders.", "适配多市场订单的柔性装配。", "Montaje flexible para varios mercados.", "Flexible Montage für verschiedene Märkte.") },
          ],
          style: { bgColor: "#f8fafc", textColor: "#475569", titleColor: "#0f172a", accentColor: accent, fontScale: 1, borderRadius: 20, animation: "fade-up" },
        }
      );
    case "gallery":
      return blockBase(
        "gallery",
        tx("Company Gallery", "公司风采", "Galería corporativa", "Unternehmensgalerie"),
        tx("Use image blocks for office, workshop, warehouse and team.", "使用图片模块展示办公室、车间、仓储与团队。", "Usa bloques visuales para oficina, taller y equipo.", "Nutze Bildblöcke für Büro, Werkstatt und Team."),
        {
          items: [
            { id: uid("gallery"), title: tx("Showroom", "展厅", "Showroom", "Showroom"), body: tx("Product wall and customer meeting area.", "产品陈列与客户洽谈区。", "Zona de exposición y reuniones.", "Ausstellungs- und Meetingbereich."), image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80" },
            { id: uid("gallery"), title: tx("Workshop", "车间", "Taller", "Werkstatt"), body: tx("Production line and quality inspection visuals.", "生产线与质检现场。", "Línea de producción y QA.", "Produktionslinie und QA."), image: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=80" },
            { id: uid("gallery"), title: tx("Team", "团队", "Equipo", "Team"), body: tx("Sales, engineering, and service support team.", "销售、工程与服务团队。", "Equipo comercial, técnico y postventa.", "Vertriebs-, Technik- und Service-Team."), image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80" },
          ],
          style: { bgColor: "#ffffff", textColor: "#475569", titleColor: "#0f172a", accentColor: accent, fontScale: 1, borderRadius: 20, animation: "zoom-in" },
        }
      );
    case "exhibition":
      return blockBase(
        "exhibition",
        tx("Trade Show Activities", "展会活动", "Actividades de ferias", "Messeaktivitäten"),
        tx("List booth plans, dates, and appointment links.", "列出展位、时间与预约链接。", "Lista stands, fechas y citas.", "Zeigt Stand, Datum und Termine."),
        {
          items: [
            { id: uid("event"), title: tx("Hannover Messe", "汉诺威工业展", "Hannover Messe", "Hannover Messe"), body: tx("Live machinery demo and distributor meeting.", "现场设备演示与代理洽谈。", "Demo en vivo y reuniones con distribuidores.", "Live-Demo und Gespräche mit Händlern.") },
            { id: uid("event"), title: tx("Canton Fair", "广交会", "Feria de Cantón", "Kanton-Messe"), body: tx("Overseas buyer booking and product launch.", "海外买家预约与新品发布。", "Reservas y lanzamientos.", "Termine und Produktneuheiten.") },
          ],
          style: { bgColor: "#0f172a", textColor: "#cbd5e1", titleColor: "#ffffff", accentColor: accent, fontScale: 1, borderRadius: 20, animation: "fade-up" },
        }
      );
    case "service":
      return blockBase(
        "service",
        tx("Service Assurance", "服务保障", "Garantía de servicio", "Servicegarantie"),
        tx("Clarify pre-sales, delivery, startup, and after-sales steps.", "清晰展示售前、交付、安装与售后流程。", "Explica preventa, entrega e instalación.", "Erklärt Pre-Sales, Lieferung und Support."),
        {
          items: [
            { id: uid("service"), title: tx("Pre-sales Consulting", "售前咨询", "Consultoría previa", "Pre-Sales-Beratung"), body: tx("Solution recommendation and configuration guidance.", "方案推荐与配置指导。", "Recomendación y configuración.", "Lösungsberatung und Konfiguration.") },
            { id: uid("service"), title: tx("Commissioning Support", "投产支持", "Soporte de puesta en marcha", "Inbetriebnahme-Support"), body: tx("Manuals, remote setup, and video guidance.", "手册、远程调试与视频指导。", "Manuales y soporte remoto.", "Handbücher und Remote-Setup.") },
            { id: uid("service"), title: tx("Spare Parts", "备件支持", "Repuestos", "Ersatzteile"), body: tx("Long-term parts supply and response process.", "长期备件供应与响应机制。", "Suministro de repuestos.", "Langfristige Ersatzteilversorgung.") },
          ],
          style: { bgColor: "#ffffff", textColor: "#475569", titleColor: "#0f172a", accentColor: accent, fontScale: 1, borderRadius: 20, animation: "fade-up" },
        }
      );
    case "logistics":
      return blockBase(
        "logistics",
        tx("Logistics & Freight", "物流货运", "Logística y flete", "Logistik & Fracht"),
        tx("Help buyers compare sea, air, rail, and express options.", "帮助买家比较海运、空运、铁路和快递方案。", "Ayuda a comparar opciones logísticas.", "Hilft beim Vergleich von Logistikoptionen."),
        {
          items: [
            { id: uid("logistics"), title: tx("Sea Freight", "海运", "Flete marítimo", "Seefracht"), body: tx("For bulk orders and better total cost.", "适合大货与整体成本优化。", "Para grandes volúmenes y menor costo.", "Für große Mengen und bessere Kosten.") },
            { id: uid("logistics"), title: tx("Air Freight", "空运", "Carga aérea", "Luftfracht"), body: tx("Fast shipment for urgent machinery parts.", "适合紧急设备与配件。", "Envío rápido para piezas urgentes.", "Schneller Versand für dringende Teile.") },
            { id: uid("logistics"), title: tx("Railway", "铁路", "Ferrocarril", "Bahntransport"), body: tx("A balanced option for Europe routes.", "适合欧洲线路的平衡方案。", "Opción equilibrada para Europa.", "Ausgewogene Option für Europa.") },
          ],
          style: { bgColor: "#f8fafc", textColor: "#475569", titleColor: "#0f172a", accentColor: accent, fontScale: 1, borderRadius: 20, animation: "fade-up" },
        }
      );
    case "im":
      return blockBase(
        "im",
        tx("IM Customer Service", "IM 客服插件", "Plugin de IM", "IM-Kundenservice"),
        tx("Expose WhatsApp, Messenger, Telegram, and WeChat access.", "展示 WhatsApp、Messenger、Telegram、微信等联系方式。", "Expone WhatsApp, Messenger, Telegram y más.", "Zeigt WhatsApp, Messenger, Telegram und mehr."),
        {
          items: [
            { id: uid("im"), title: tx("WhatsApp", "WhatsApp", "WhatsApp", "WhatsApp"), body: tx("+86 188 0000 5566", "+86 188 0000 5566", "+86 188 0000 5566", "+86 188 0000 5566"), link: "https://wa.me/8618800005566" },
            { id: uid("im"), title: tx("Messenger", "Messenger", "Messenger", "Messenger"), body: tx("Machina Global Official", "Machina Global 官方", "Machina Global Oficial", "Machina Global Offiziell"), link: "https://m.me" },
            { id: uid("im"), title: tx("Telegram", "Telegram", "Telegram", "Telegram"), body: tx("@machina_global", "@machina_global", "@machina_global", "@machina_global"), link: "https://t.me" },
          ],
          style: { bgColor: "#0f172a", textColor: "#cbd5e1", titleColor: "#ffffff", accentColor: accent, fontScale: 1, borderRadius: 20, animation: "zoom-in" },
        }
      );
    case "contact":
      return blockBase(
        "contact",
        tx("Contact & Inquiry", "联系询盘", "Contacto y consulta", "Kontakt & Anfrage"),
        tx("Responsive inquiry form with image/text and plugin extension points.", "自适应询盘表单，支持图文内容与插件扩展。", "Formulario adaptable con extensiones plugin.", "Responsives Formular mit Plugin-Erweiterung."),
        {
          body: tx("Collect name, company, email, country, and project requirements directly.", "直接收集姓名、公司、邮箱、国家和项目需求。", "Recoge nombre, empresa, correo y requisitos.", "Erfasst Name, Firma, E-Mail und Anforderungen."),
          ctaText: tx("Send Inquiry", "发送询盘", "Enviar consulta", "Anfrage senden"),
          style: { bgColor: "#ffffff", textColor: "#475569", titleColor: "#0f172a", accentColor: accent, fontScale: 1, borderRadius: 24, animation: "fade-up" },
        }
      );
    case "testimonials":
      return blockBase(
        "testimonials",
        tx("Testimonials", "客户评价", "Testimonios", "Kundenstimmen"),
        tx("Social proof for distributors and industrial buyers.", "适合分销商和工业买家的社会证明。", "Prueba social para distribuidores.", "Sozialer Beweis für Händler."),
        {
          items: [
            { id: uid("quote"), title: tx("Germany Partner", "德国合作伙伴", "Socio alemán", "Partner aus Deutschland"), body: tx("Stable quality, clear docs, and smooth communication.", "品质稳定，资料清晰，沟通顺畅。", "Calidad estable y buena comunicación.", "Stabile Qualität und gute Kommunikation.") },
            { id: uid("quote"), title: tx("UAE Buyer", "阿联酋买家", "Comprador EAU", "Käufer aus den VAE"), body: tx("Fast response and complete solution planning.", "响应很快，方案完整。", "Respuesta rápida y solución completa.", "Schnelle Reaktion und vollständige Lösung.") },
          ],
          style: { bgColor: "#f8fafc", textColor: "#475569", titleColor: "#0f172a", accentColor: accent, fontScale: 1, borderRadius: 20, animation: "zoom-in" },
        }
      );
  }
}

function buildDefaultBlocks(layoutVariant: SiteBuilderState["layoutVariant"], accent: string) {
  const blockOrderByLayout: Record<SiteBuilderState["layoutVariant"], BlockType[]> = {
    summit: [
      "hero",
      "products",
      "company",
      "service",
      "cases",
      "factory",
      "gallery",
      "news",
      "videos",
      "blog",
      "social",
      "faq",
      "exhibition",
      "logistics",
      "im",
      "contact",
    ],
    catalog: [
      "hero",
      "products",
      "service",
      "logistics",
      "faq",
      "cases",
      "news",
      "videos",
      "blog",
      "company",
      "factory",
      "gallery",
      "social",
      "im",
      "contact",
    ],
    showcase: [
      "hero",
      "company",
      "factory",
      "gallery",
      "cases",
      "videos",
      "products",
      "exhibition",
      "service",
      "faq",
      "news",
      "blog",
      "social",
      "im",
      "contact",
    ],
  };

  return blockOrderByLayout[layoutVariant].map((type) =>
    createBlockByType(type, accent)
  );
}

export function createDefaultBuilderState(
  template?: WebsiteTemplatePreset,
  content?: Parameters<typeof applyWebsiteContentToBuilderState>[1]
): SiteBuilderState {
  const currentTemplate = template || defaultWebsiteTemplatePreset;
  const accent = currentTemplate.primaryColor || "#2563eb";
  return applyWebsiteContentToBuilderState({
    templateId: currentTemplate.id,
    templateName: currentTemplate.name,
    layoutVariant: currentTemplate.layoutVariant,
    siteName: currentTemplate.name,
    brandName: currentTemplate.brandName,
    companyEnglishName: currentTemplate.brandName,
    industry: currentTemplate.industry,
    activeLanguage: "en",
    languages: [...DEFAULT_LANGUAGES],
    theme: {
      primaryColor: accent,
      secondaryColor: "#0ea5e9",
      canvasColor: "#e2e8f0",
      surfaceColor: "#ffffff",
      mutedColor: "#64748b",
      fontFamily: "Inter, system-ui, sans-serif",
    },
    contact: {
      email: "sales@machinaglobal.com",
      phone: "+86 188 0000 5566",
      address: "Export Industrial Park, Suzhou, China",
      whatsapp: "+86 188 0000 5566",
      website: "www.machinaglobal.com",
      contactPerson: "Sophia Zhang",
      fax: "",
    },
    homepageTitle: currentTemplate.brandName,
    logoUrl: "",
    logoAlt: `${currentTemplate.brandName} logo`,
    faviconUrl: "",
    footerCopyright: "",
    brandType: "",
    blocks: buildDefaultBlocks(currentTemplate.layoutVariant, accent),
    navigation: content?.navigation
      ? cloneBuilderState(content.navigation)
      : undefined,
    customerService: {
      enabled: false,
      avatarId: "pro-female",
      avatarName: "专业女客服",
      avatarStyle: "professional",
      avatarColor: "#3b82f6",
      greeting: "您好，我是您的专属客服小美，请问有什么可以帮您？",
      animationStyle: "pulse",
      soundEnabled: false,
      soundVolume: 45,
      soundStyle: "crisp",
      voiceEnabled: false,
      voiceGender: "female",
      voiceRate: 1.3,
      launcherLabel: "在线聊天客服",
      panelTitle: "在线客服",
      inputPlaceholder: "请输入您的需求...",
      sendLabel: "发送",
    },
  }, content);
}

export function normalizeBuilderState(
  value: unknown,
  template?: WebsiteTemplatePreset,
  content?: Parameters<typeof applyWebsiteContentToBuilderState>[1]
): SiteBuilderState {
  const fallback = createDefaultBuilderState(template, content);
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<SiteBuilderState>;
  if (!Array.isArray(candidate.blocks)) return fallback;
  return applyWebsiteContentToBuilderState({
    ...fallback,
    ...candidate,
    templateName: candidate.templateName || fallback.templateName,
    layoutVariant: candidate.layoutVariant || fallback.layoutVariant,
    theme: { ...fallback.theme, ...(candidate.theme || {}) },
    contact: { ...fallback.contact, ...(candidate.contact || {}) },
    navigation: candidate.navigation || fallback.navigation,
    customerService: candidate.customerService
      ? {
          ...fallback.customerService,
          ...candidate.customerService,
        }
      : fallback.customerService,
    homepageTitle: candidate.homepageTitle || fallback.homepageTitle,
    logoUrl: candidate.logoUrl || fallback.logoUrl,
    logoAlt: candidate.logoAlt || fallback.logoAlt,
    faviconUrl: candidate.faviconUrl || fallback.faviconUrl,
    footerCopyright: candidate.footerCopyright || fallback.footerCopyright,
    companyEnglishName: candidate.companyEnglishName || fallback.companyEnglishName,
    brandType: candidate.brandType || fallback.brandType,
    languages:
      Array.isArray(candidate.languages) && candidate.languages.length >= DEFAULT_LANGUAGES.length
        ? candidate.languages
        : fallback.languages,
    blocks: candidate.blocks as SiteBlock[],
  }, content);
}

export function cloneBuilderState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function applyQuickPromptToBuilder(state: SiteBuilderState, prompt: string) {
  const next = cloneBuilderState(state);
  const text = prompt.toLowerCase();
  const actions: string[] = [];

  if (/深色|dark|black|黑色/.test(text)) {
    next.theme.primaryColor = "#1d4ed8";
    next.theme.secondaryColor = "#38bdf8";
    next.blocks = next.blocks.map((block) =>
      block.type === "hero" || block.type === "cases" || block.type === "social" || block.type === "im" || block.type === "exhibition"
        ? { ...block, style: { ...block.style, bgColor: "#0f172a", textColor: "#cbd5e1", titleColor: "#ffffff", accentColor: next.theme.primaryColor } }
        : block
    );
    actions.push("已切换为更专业的深色机械行业风格");
  }

  if (/评价|testimonial/.test(text) && !next.blocks.some((block) => block.type === "testimonials")) {
    const insertAt = Math.min(next.blocks.length - 1, 4);
    next.blocks.splice(insertAt, 0, createBlockByType("testimonials", next.theme.primaryColor));
    actions.push("已添加客户评价模块");
  }

  if (/展会/.test(text)) {
    const block = next.blocks.find((item) => item.type === "exhibition");
    if (block) block.visible = true;
    actions.push("已启用展会活动模块");
  }

  if (/物流/.test(text)) {
    const block = next.blocks.find((item) => item.type === "logistics");
    if (block) block.visible = true;
    actions.push("已启用物流货运模块");
  }

  if (/客服|im|whatsapp/.test(text)) {
    const block = next.blocks.find((item) => item.type === "im");
    if (block) block.visible = true;
    actions.push("已启用 IM 客服插件模块");
  }

  if (/西班牙|español|spanish/.test(text)) {
    next.activeLanguage = "es";
    actions.push("已切换默认语言到西班牙语");
  }

  if (/德语|german|deutsch/.test(text)) {
    next.activeLanguage = "de";
    actions.push("已切换默认语言到德语");
  }

  if (/中文|china|chinese/.test(text)) {
    next.activeLanguage = "zh";
    actions.push("已切换默认语言到中文");
  }

  if (/英语|english/.test(text)) {
    next.activeLanguage = "en";
    actions.push("已切换默认语言到英语");
  }

  if (/工厂背景图|背景图/.test(text)) {
    const hero = next.blocks.find((item) => item.type === "hero");
    if (hero) {
      hero.image = "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1600&q=80";
      actions.push("已替换 Hero 工厂背景图");
    }
  }

  if (/核心优势|优势三列/.test(text)) {
    const service = next.blocks.find((item) => item.type === "service");
    if (service) {
      service.items = [
        { id: uid("adv"), title: tx("Export Ready", "出口就绪", "Listo para exportar", "Exportbereit"), body: tx("Catalog, docs, and compliance support.", "目录、资料和合规支持。", "Catálogo, documentación y soporte.", "Katalog, Doku und Compliance.") },
        { id: uid("adv"), title: tx("Fast Response", "快速响应", "Respuesta rápida", "Schnelle Reaktion"), body: tx("12-hour quotation cycle.", "12 小时报价节奏。", "Cotización en 12 horas.", "Angebot in 12 Stunden.") },
        { id: uid("adv"), title: tx("Flexible Customization", "灵活定制", "Personalización flexible", "Flexible Anpassung"), body: tx("OEM / ODM / multilingual branding.", "OEM / ODM / 多语言品牌定制。", "OEM / ODM / marca multilingüe.", "OEM / ODM / mehrsprachiges Branding.") },
      ];
      actions.push("已把服务保障模块强化为核心优势三列");
    }
  }

  return {
    state: next,
    message: actions.length
      ? `${actions.join("；")}。你可以继续拖拽排序、改颜色、改语言和发布。`
      : "我已经收到你的建站意图。现在这个版本更适合直接在右侧可视化编辑器里拖拽模块、改文案、改样式和切语言。",
  };
}

export function buildSiteHtml(state: SiteBuilderState) {
  const payload = JSON.stringify(JSON.stringify(state))
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
  const layoutVariant = state.layoutVariant || "summit";
  return `<!DOCTYPE html>
<html lang="${state.activeLanguage}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${state.homepageTitle || state.brandName}</title>
  ${state.faviconUrl ? `<link rel="icon" href="${state.faviconUrl}" />` : ""}
  <style>
    :root{
      --primary:${state.theme.primaryColor};
      --secondary:${state.theme.secondaryColor};
      --tradepro-shared-floating-service-safe-right:72px;
      --canvas:${state.theme.canvasColor};
      --surface:${state.theme.surfaceColor};
      --muted:${state.theme.mutedColor};
      --font:${state.theme.fontFamily};
    }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;font-family:var(--font);background:var(--canvas);color:#0f172a}
    body{line-height:1.6}
    a{text-decoration:none;color:inherit}
    img{display:block;max-width:100%}
    .site-shell{min-height:100vh;background:var(--canvas)}
    .site-header{position:sticky;top:0;z-index:60;background:rgba(15,23,42,0.92);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,0.08)}
    .site-header-inner,.section-inner,.footer-inner{max-width:1200px;margin:0 auto;padding:0 20px}
    .site-header-inner{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:16px;padding-bottom:16px}
    .brand-wrap{display:flex;align-items:center;gap:12px}
    .brand-logo{width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700}
    .brand-name{font-size:16px;font-weight:700;color:#fff}
    .brand-sub{font-size:12px;color:#94a3b8}
    .nav-links{display:flex;flex-wrap:wrap;gap:14px;color:#cbd5e1;font-size:14px}
    .nav-item{position:relative;padding:6px 0}
    .nav-item>a{display:inline-flex;align-items:center;gap:4px}
    .nav-item.has-children>a::after{content:"";width:6px;height:6px;border-right:1px solid currentColor;border-bottom:1px solid currentColor;transform:rotate(45deg);margin-top:-3px;opacity:.72}
    .nav-dropdown{position:absolute;left:0;top:100%;min-width:180px;padding:8px;border-radius:16px;background:#fff;color:#0f172a;border:1px solid rgba(148,163,184,.24);box-shadow:0 24px 60px rgba(15,23,42,.18);display:none;z-index:90}
    .nav-item:hover>.nav-dropdown,.nav-item:focus-within>.nav-dropdown{display:block}
    .nav-dropdown a{display:block;padding:8px 10px;border-radius:10px;color:#334155;white-space:nowrap}
    .nav-dropdown a:hover{background:#eff6ff;color:#1d4ed8}
    .nav-children{margin-left:12px;border-left:1px solid #e2e8f0;padding-left:8px}
    .header-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}
    .language-switcher{position:relative}
    .language-trigger{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:999px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:#fff;cursor:pointer;font-size:13px;font-weight:600}
    .language-menu{position:absolute;right:0;top:calc(100% + 10px);min-width:240px;max-height:360px;overflow:auto;padding:8px;border-radius:18px;background:#fff;border:1px solid rgba(148,163,184,.18);box-shadow:0 24px 60px rgba(15,23,42,.18);display:none;z-index:80}
    .language-menu.open{display:block}
    .language-option{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:12px;background:transparent;border:0;cursor:pointer;text-align:left}
    .language-option:hover,.language-option.active{background:#eff6ff}
    .language-flag{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:#f8fafc;font-size:16px;flex-shrink:0}
    .language-labels{min-width:0;display:flex;flex-direction:column}
    .language-labels strong{font-size:13px;color:#0f172a}
    .language-labels span{font-size:11px;color:#64748b}
    .primary-button{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:999px;background:var(--primary);color:#fff;padding:12px 22px;font-weight:600;cursor:pointer}
    .section{padding:64px 0}
    .section.dark{background:#0f172a;color:#cbd5e1}
    .section-grid{display:grid;gap:24px}
    .hero-grid{display:grid;grid-template-columns:1.1fr 0.9fr;gap:28px;align-items:center}
    .hero-card,.panel,.card,.faq-item,.contact-card{box-shadow:0 20px 60px rgba(15,23,42,0.12)}
    .hero-card,.panel,.card,.faq-item,.contact-card{border:1px solid rgba(148,163,184,0.16)}
    .hero-card,.panel,.card,.faq-item,.contact-card{background:rgba(255,255,255,0.92)}
    .dark .hero-card,.dark .panel,.dark .card,.dark .faq-item,.dark .contact-card{background:rgba(15,23,42,0.62);border-color:rgba(255,255,255,0.08)}
    .hero-card{padding:24px}
    .eyebrow{display:inline-flex;align-items:center;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.14);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#fff;margin-bottom:18px}
    .hero-title{font-size:48px;line-height:1.1;margin:0;color:#fff}
    .hero-subtitle{font-size:18px;color:#cbd5e1;margin:18px 0 0}
    .hero-body{font-size:15px;color:#e2e8f0;margin:16px 0 0;max-width:720px}
    .hero-buttons{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
    .secondary-button{display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.18);border-radius:999px;color:#fff;padding:12px 22px}
    .hero-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:28px}
    .stat-card{padding:16px;border-radius:18px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12)}
    .stat-value{font-size:28px;font-weight:700;color:#fff}
    .stat-label{font-size:12px;color:#cbd5e1;margin-top:6px}
    .hero-visual{position:relative;overflow:hidden;border-radius:28px;min-height:420px;background:#0f172a}
    .hero-visual img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .hero-visual::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,23,42,.18),rgba(15,23,42,.74))}
    .hero-visual-copy{position:absolute;left:24px;right:24px;bottom:24px;z-index:2;padding:20px;border-radius:24px;background:rgba(15,23,42,.64);border:1px solid rgba(255,255,255,.08);color:#fff}
    .section-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:28px}
    .section-kicker{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--primary);font-weight:700}
    .section-title{font-size:34px;line-height:1.2;margin:10px 0 0}
    .section-subtitle{max-width:780px;color:var(--muted);margin-top:12px}
    .card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
    .two-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
    .card{border-radius:24px;overflow:hidden}
    .card .card-image{height:220px;background:#cbd5e1}
    .card .card-image img{width:100%;height:100%;object-fit:cover}
    .card-content{padding:22px}
    .card-title{font-size:20px;font-weight:700;margin:0}
    .card-body{font-size:14px;color:var(--muted);margin-top:12px}
    .card-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    .card-link{margin-top:18px;display:inline-flex;color:var(--primary);font-weight:600}
    .company-grid{display:grid;grid-template-columns:0.9fr 1.1fr;gap:24px;align-items:start}
    .company-image{overflow:hidden;border-radius:28px;min-height:440px}
    .company-image img{width:100%;height:100%;object-fit:cover}
    .info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:22px}
    .panel{padding:20px;border-radius:22px}
    .panel-link{display:flex;flex-direction:column;justify-content:space-between;gap:14px;min-height:100%}
    .panel-title{font-weight:700;font-size:18px;margin:0}
    .panel-body{font-size:14px;color:var(--muted);margin-top:10px}
    .panel-value{font-size:13px;font-weight:700;color:var(--primary);margin-top:12px}
    .list-stack{display:grid;gap:14px}
    .faq-item{border-radius:20px;padding:18px;border:1px solid rgba(148,163,184,.22);background:rgba(255,255,255,.72)}
    .dark .faq-item{background:rgba(15,23,42,.36);border-color:rgba(148,163,184,.16)}
    .faq-index{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;padding:0 10px;border-radius:999px;background:rgba(37,99,235,.12);color:var(--primary);font-size:12px;font-weight:700;margin-bottom:12px}
    .faq-question{font-size:16px;font-weight:700;margin:0}
    .faq-answer{font-size:14px;color:var(--muted);margin-top:10px}
    .contact-layout{display:grid;grid-template-columns:0.95fr 1.05fr;gap:24px}
    .contact-card{border-radius:26px;padding:24px}
    .contact-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:20px}
    .contact-meta .panel{padding:18px}
    .contact-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .contact-form input,.contact-form textarea,.contact-form select{width:100%;padding:14px 16px;border-radius:16px;border:1px solid #cbd5e1;background:#fff;font:inherit;color:#0f172a}
    .contact-form textarea{min-height:140px;grid-column:1/-1;resize:vertical}
    .chip-row{display:flex;flex-wrap:wrap;gap:10px}
    .chip{display:inline-flex;padding:8px 12px;border-radius:999px;background:rgba(15,23,42,0.06);font-size:12px;color:#334155}
    .dark .chip{background:rgba(255,255,255,0.08);color:#cbd5e1}
    .quick-tags{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
    .im-card{display:flex;flex-direction:column;gap:12px}
    .im-action{display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:999px;background:rgba(37,99,235,.12);color:var(--primary);font-size:13px;font-weight:700}
    .timeline-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
    .timeline-card{padding:22px;border-radius:24px;border:1px solid rgba(148,163,184,.2);background:rgba(255,255,255,.82)}
    .dark .timeline-card{background:rgba(15,23,42,.36);border-color:rgba(148,163,184,.16)}
    .timeline-top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
    .timeline-value{font-size:13px;font-weight:700;color:var(--primary)}
    .timeline-link{display:inline-flex;margin-top:16px;color:var(--primary);font-weight:700}
    .footer{background:#020617;color:#94a3b8;border-top:1px solid rgba(255,255,255,0.08)}
    .footer-inner{padding-top:28px;padding-bottom:28px;display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}
    .floating-im{position:fixed;right:18px;bottom:18px;z-index:70;display:flex;flex-direction:column;gap:10px}
    .floating-box{border-radius:18px;padding:14px 16px;background:#0f172a;color:#fff;box-shadow:0 18px 40px rgba(15,23,42,0.28)}
    .cs-widget{position:fixed;right:var(--tradepro-shared-floating-service-safe-right,72px);bottom:18px;z-index:95;display:flex;flex-direction:column;align-items:flex-end;gap:12px}
    .cs-launcher{display:flex;align-items:center;gap:12px;padding:10px 14px;border:0;border-radius:999px;background:#0f172a;color:#fff;box-shadow:0 20px 44px rgba(15,23,42,.28);cursor:pointer;max-width:min(92vw,320px)}
    .cs-avatar-shell{position:relative;display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:999px;background:linear-gradient(135deg,var(--primary),var(--secondary));overflow:hidden;flex-shrink:0}
    .cs-avatar-shell img,.cs-avatar-shell video{width:100%;height:100%;object-fit:cover;border-radius:999px}
    .cs-avatar-fallback{display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:12px;font-weight:700;color:#fff}
    .cs-launcher-copy{min-width:0;display:flex;flex-direction:column;align-items:flex-start}
    .cs-launcher-copy strong{font-size:14px;line-height:1.25;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}
    .cs-launcher-copy span{font-size:12px;line-height:1.4;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}
    .cs-panel{width:min(92vw,360px);border-radius:24px;background:#fff;border:1px solid rgba(148,163,184,.22);box-shadow:0 28px 70px rgba(15,23,42,.24);overflow:hidden}
    .cs-panel-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:#0f172a;color:#fff}
    .cs-panel-title{display:flex;align-items:center;gap:12px;min-width:0}
    .cs-panel-title-copy{min-width:0}
    .cs-panel-title-copy strong{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cs-panel-title-copy span{display:block;font-size:12px;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cs-close{border:0;background:transparent;color:#cbd5e1;font-size:18px;cursor:pointer}
    .cs-messages{display:flex;flex-direction:column;gap:12px;padding:16px;max-height:min(52vh,360px);overflow:auto;background:linear-gradient(180deg,#f8fafc,#eef2ff)}
    .cs-message{max-width:85%;padding:10px 12px;border-radius:18px;font-size:13px;line-height:1.6;box-shadow:0 10px 24px rgba(15,23,42,.08)}
    .cs-message.assistant{align-self:flex-start;background:#fff;color:#0f172a;border-bottom-left-radius:8px}
    .cs-message.user{align-self:flex-end;background:var(--primary);color:#fff;border-bottom-right-radius:8px}
    .cs-panel-body{padding:14px 16px;border-top:1px solid rgba(226,232,240,.9);background:#fff}
    .cs-panel-actions{display:flex;gap:10px;align-items:flex-end}
    .cs-panel-actions textarea{flex:1;min-height:84px;resize:vertical;border:1px solid #cbd5e1;border-radius:16px;padding:12px 14px;font:inherit;color:#0f172a;background:#fff}
    .cs-send{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:16px;padding:12px 16px;background:var(--primary);color:#fff;font-weight:700;cursor:pointer;min-width:74px}
    .cs-hint{margin-top:10px;font-size:12px;color:#64748b}
    .is-hidden{display:none!important}
    .layout-summit .site-header{background:linear-gradient(90deg, rgba(10,15,34,.98), rgba(15,23,42,.92));}
    .layout-summit .hero-grid{grid-template-columns:1.08fr 0.92fr}
    .layout-summit .hero-visual{min-height:470px;border-radius:34px}
    .layout-summit .card{border-radius:30px}
    .layout-summit .hero-stats{grid-template-columns:repeat(3,minmax(0,1fr))}
    .layout-catalog .site-header{background:rgba(7,20,28,0.94)}
    .layout-catalog .hero-grid{grid-template-columns:0.95fr 1.05fr}
    .layout-catalog .hero-visual{min-height:420px;border-radius:20px}
    .layout-catalog .card-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
    .layout-catalog .card{border-radius:18px}
    .layout-catalog .hero-stats{grid-template-columns:repeat(4,minmax(0,1fr))}
    .layout-catalog .hero-visual-copy{display:grid;gap:14px}
    .layout-showcase .site-header{background:rgba(8,26,16,0.94)}
    .layout-showcase .hero-grid{grid-template-columns:1fr 1fr}
    .layout-showcase .hero-visual{min-height:500px;border-radius:40px}
    .layout-showcase .panel,.layout-showcase .faq-item,.layout-showcase .contact-card{border-radius:18px}
    .layout-showcase .card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    .layout-showcase .hero-visual-copy{backdrop-filter:blur(12px)}
    [data-animation="fade-up"]{animation:fadeUp .6s ease both}
    [data-animation="zoom-in"]{animation:zoomIn .5s ease both}
    @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
    @keyframes zoomIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
    @media (max-width: 960px){
      .nav-links{display:none}
      .hero-grid,.company-grid,.contact-layout,.two-grid,.timeline-grid,.contact-meta{grid-template-columns:1fr}
      .card-grid{grid-template-columns:1fr}
      .contact-form{grid-template-columns:1fr}
      .hero-title{font-size:38px}
      .hero-stats{grid-template-columns:1fr}
      .section{padding:48px 0}
      .language-menu{right:auto;left:0;min-width:220px}
    }
  </style>
</head>
<body>
  <div id="site-root"></div>
  <script>
    (function installObserverGuards() {
      function isNodeLikeTarget(target) {
        return !!target && typeof target === "object" && typeof target.nodeType === "number" && target.nodeType > 0;
      }

      function maybePatchObserve(ObserverClass) {
        if (!ObserverClass || !ObserverClass.prototype || typeof ObserverClass.prototype.observe !== "function" || ObserverClass.prototype.__codexSafeObservePatched) {
          return;
        }

        try {
          const originalObserve = ObserverClass.prototype.observe;
          ObserverClass.prototype.observe = function safeObserve(target, options) {
            if (!isNodeLikeTarget(target)) {
              console.warn("Skipped site preview observer registration for a non-node target.");
              return;
            }

            try {
              return originalObserve.call(this, target, options);
            } catch (error) {
              console.warn("Skipped site preview observer registration after observe() rejected the target.", error);
              return;
            }
          };
          ObserverClass.prototype.__codexSafeObservePatched = true;
        } catch (error) {
          console.warn("Site preview observer guard patch skipped; browser keeps native behavior.", error);
        }
      }

      maybePatchObserve(window.MutationObserver);
      maybePatchObserve(window.ResizeObserver);
    })();

    const siteState = JSON.parse(${payload});
    const root = document.getElementById("site-root");
    let currentLanguage = siteState.activeLanguage || "en";
    let languageMenuOpen = false;
    function getCurrentPageKey() {
      const page = new URLSearchParams(window.location.search).get('page') || 'hero';
      return page.replace(/^[/#]+/, '').split('/')[0] || 'hero';
    }

    const layoutVariant = ${JSON.stringify(layoutVariant)};
    const layoutClass = layoutVariant === "catalog" ? "layout-catalog" : layoutVariant === "showcase" ? "layout-showcase" : "layout-summit";
    document.body.className = layoutClass;

    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function t(map, lang) {
      if (!map) return "";
      return map[lang] || map.en || "";
    }

    function blockHeading(block, lang) {
      return '<div class="section-head"><div><div class="section-kicker">' + escapeHtml(block.type) + '</div><h2 class="section-title" style="color:' + escapeHtml(block.style.titleColor) + ';font-size:' + (34 * (block.style.fontScale || 1)) + 'px">' + escapeHtml(t(block.title, lang)) + '</h2><p class="section-subtitle" style="color:' + escapeHtml(block.style.textColor) + ';">' + escapeHtml(t(block.subtitle, lang)) + '</p></div></div>';
    }

    function routeLabel(type, lang) {
      const labels = {
        hero: { en: 'Home' },
        products: { en: 'Products' },
        company: { en: 'Company' },
        cases: { en: 'Cases' },
        news: { en: 'News' },
        videos: { en: 'Videos' },
        blog: { en: 'Blog' },
        social: { en: 'Social' },
        faq: { en: 'FAQ' },
        factory: { en: 'Factory' },
        gallery: { en: 'Gallery' },
        exhibition: { en: 'Exhibition' },
        service: { en: 'Services' },
        logistics: { en: 'Logistics' },
        im: { en: 'IM Support' },
        contact: { en: 'Contact' },
        testimonials: { en: 'Testimonials' },
      };
      const preset = labels[type];
      return preset && preset[lang] ? preset[lang] : (preset && preset.en ? preset.en : type);
    }

    function renderHeroRouteChips(lang) {
      return siteState.blocks
        .filter(function(block){ return block.visible && block.type !== 'hero'; })
        .slice(0, 6)
        .map(function(block){
          return '<span class="chip">' + escapeHtml(routeLabel(block.type, lang)) + '</span>';
        })
        .join('');
    }

    function renderHeroAside(lang) {
      if (layoutVariant === 'catalog') {
        return '<div><strong style="display:block;font-size:18px;margin-bottom:8px;">Product Index</strong><div style="font-size:14px;color:#cbd5e1;">Catalog-first product routing with quick RFQ actions and download entry.</div><div class="chip-row" style="margin-top:14px;"><span class="chip">Datasheets</span><span class="chip">MOQ</span><span class="chip">OEM</span><span class="chip">Certifications</span></div><div class="chip-row" style="margin-top:10px;"><span class="chip">Pumps</span><span class="chip">Valves</span><span class="chip">Controls</span><span class="chip">Components</span></div></div>';
      }
      if (layoutVariant === 'showcase') {
        return '<div><strong style="display:block;font-size:18px;margin-bottom:8px;">Factory Trust Center</strong><div style="font-size:14px;color:#cbd5e1;">Showroom, workshop, exhibitions, and reference projects presented for global buyers.</div><div class="chip-row" style="margin-top:14px;"><span class="chip">Factory Tour</span><span class="chip">Showroom</span><span class="chip">QC Process</span><span class="chip">Buyer Visits</span></div><div class="chip-row" style="margin-top:10px;"><span class="chip">Trade Fairs</span><span class="chip">Case Photos</span><span class="chip">Company Story</span></div></div>';
      }
      return '<div><strong style="display:block;font-size:18px;margin-bottom:8px;">Global Conversion Stack</strong><div style="font-size:14px;color:#cbd5e1;">Built for multilingual B2B lead capture, product routing, IM conversion, and quote acceleration.</div><div class="chip-row" style="margin-top:14px;">' + renderHeroRouteChips(lang) + '</div></div>';
    }

    function renderMetaChips(item) {
      const chips = [item.value, item.link].filter(Boolean).map(function(value){
        return '<span class="chip">' + escapeHtml(value) + '</span>';
      }).join('');
      return chips ? '<div class="card-meta">' + chips + '</div>' : '';
    }

    function renderCardItems(items, lang, accent) {
      return (items || []).map(function(item){
        const image = item.image ? '<div class="card-image"><img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(t(item.title, lang)) + '"></div>' : '';
        const link = item.link ? '<a class="card-link" href="' + escapeHtml(item.link) + '" target="_blank" rel="noreferrer">Open</a>' : '';
        const value = item.value ? '<div class="panel-value">' + escapeHtml(item.value) + '</div>' : '';
        return '<article class="card"><div>' + image + '<div class="card-content"><h3 class="card-title">' + escapeHtml(t(item.title, lang)) + '</h3><p class="card-body">' + escapeHtml(t(item.body, lang)) + '</p>' + value + renderMetaChips(item) + link + '</div></div></article>';
      }).join('');
    }

    function renderSimplePanels(items, lang) {
      return '<div class="info-grid">' + (items || []).map(function(item){
        const value = item.value ? '<div class="panel-value">' + escapeHtml(item.value) + '</div>' : '';
        const link = item.link ? '<a class="card-link" href="' + escapeHtml(item.link) + '" target="_blank" rel="noreferrer">Learn more</a>' : '';
        return '<div class="panel"><div class="panel-link"><div><h3 class="panel-title">' + escapeHtml(t(item.title, lang)) + '</h3><p class="panel-body">' + escapeHtml(t(item.body, lang)) + '</p>' + value + '</div>' + link + '</div></div>';
      }).join('') + '</div>';
    }

    function renderFaq(items, lang) {
      return '<div class="list-stack">' + (items || []).map(function(item){
        const index = item.value ? '<div class="faq-index">' + escapeHtml(item.value) + '</div>' : '';
        return '<div class="faq-item">' + index + '<h3 class="faq-question">' + escapeHtml(t(item.title, lang)) + '</h3><p class="faq-answer">' + escapeHtml(t(item.body, lang)) + '</p></div>';
      }).join('') + '</div>';
    }

    function renderSocial(items, lang) {
      return '<div class="card-grid">' + (items || []).map(function(item){
        const href = item.link || '#';
        const value = item.value ? '<div class="panel-value">' + escapeHtml(item.value) + '</div>' : '';
        return '<a class="panel" href="' + escapeHtml(href) + '" target="_blank" rel="noreferrer"><div class="im-card"><div><h3 class="panel-title">' + escapeHtml(t(item.title, lang)) + '</h3><p class="panel-body">' + escapeHtml(t(item.body, lang)) + '</p>' + value + '</div><span class="im-action">Open Channel</span></div></a>';
      }).join('') + '</div>';
    }

    function renderTimeline(items, lang) {
      return '<div class="timeline-grid">' + (items || []).map(function(item){
        const value = item.value ? '<div class="timeline-value">' + escapeHtml(item.value) + '</div>' : '';
        const link = item.link ? '<a class="timeline-link" href="' + escapeHtml(item.link) + '" target="_blank" rel="noreferrer">View detail</a>' : '';
        const image = item.image ? '<div class="card-image" style="height:180px;margin-top:16px;border-radius:20px;overflow:hidden;"><img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(t(item.title, lang)) + '"></div>' : '';
        return '<article class="timeline-card"><div class="timeline-top"><div><h3 class="panel-title">' + escapeHtml(t(item.title, lang)) + '</h3><p class="panel-body">' + escapeHtml(t(item.body, lang)) + '</p></div>' + value + '</div>' + image + link + '</article>';
      }).join('') + '</div>';
    }

    function renderHero(block, lang) {
      const stats = (block.items || []).map(function(item){
        return '<div class="stat-card"><div class="stat-value">' + escapeHtml(item.value || t(item.title, lang)) + '</div><div class="stat-label">' + escapeHtml(t(item.body, lang)) + '</div></div>';
      }).join('');
      const eyebrow = layoutVariant === 'catalog' ? 'PRODUCT-FIRST B2B CATALOG' : layoutVariant === 'showcase' ? 'FACTORY SHOWCASE EXPORT SITE' : 'MULTILINGUAL B2B WEBSITE';
      const secondaryLabel = layoutVariant === 'catalog' ? 'Browse Product Routes' : layoutVariant === 'showcase' ? 'View Factory Sections' : 'View Modules';
      return '<section id="hero" class="section dark" style="background:' + escapeHtml(block.style.bgColor) + ';" data-animation="' + escapeHtml(block.style.animation) + '"><div class="section-inner hero-grid"><div><div class="eyebrow">' + eyebrow + '</div><h1 class="hero-title" style="font-size:' + (48 * (block.style.fontScale || 1)) + 'px;">' + escapeHtml(t(block.title, lang)) + '</h1><p class="hero-subtitle">' + escapeHtml(t(block.subtitle, lang)) + '</p><p class="hero-body">' + escapeHtml(t(block.body, lang)) + '</p><div class="hero-buttons"><a class="primary-button" href="?page=contact" data-site-page="true" style="background:' + escapeHtml(block.style.accentColor) + '">' + escapeHtml(t(block.ctaText, lang)) + '</a><a class="secondary-button" href="?page=products" data-site-page="true">' + secondaryLabel + '</a></div><div class="hero-stats">' + stats + '</div></div><div class="hero-visual"><img src="' + escapeHtml(block.image || '') + '" alt="' + escapeHtml(t(block.title, lang)) + '"><div class="hero-visual-copy"><strong style="display:block;font-size:18px;margin-bottom:8px;">' + escapeHtml(siteState.brandName) + '</strong><div style="font-size:14px;color:#cbd5e1;">' + escapeHtml(siteState.industry) + '</div>' + renderHeroAside(lang) + '</div></div></div></section>';
    }

    function renderBlock(block, lang) {
      if (!block.visible) return '';
      const dark = block.style.bgColor.toLowerCase() === '#0f172a';
      const sectionClass = 'section' + (dark ? ' dark' : '');
      const wrapStart = '<section id="' + escapeHtml(block.type) + '" class="' + sectionClass + '" style="background:' + escapeHtml(block.style.bgColor) + ';color:' + escapeHtml(block.style.textColor) + ';" data-animation="' + escapeHtml(block.style.animation) + '"><div class="section-inner">';
      const wrapEnd = '</div></section>';

      if (block.type === 'hero') return renderHero(block, lang);
      if (block.type === 'products' || block.type === 'cases' || block.type === 'news' || block.type === 'videos' || block.type === 'blog' || block.type === 'gallery' || block.type === 'testimonials') {
        const gridClass = layoutVariant === 'showcase' && (block.type === 'cases' || block.type === 'gallery') ? 'two-grid' : 'card-grid';
        return wrapStart + blockHeading(block, lang) + '<div class="' + gridClass + '">' + renderCardItems(block.items, lang, block.style.accentColor) + '</div>' + wrapEnd;
      }
      if (block.type === 'company' || block.type === 'factory' || block.type === 'service') {
        const image = block.image ? '<div class="company-image"><img src="' + escapeHtml(block.image) + '" alt="' + escapeHtml(t(block.title, lang)) + '"></div>' : '';
        return wrapStart + '<div class="company-grid">' + image + '<div>' + blockHeading(block, lang) + '<p class="panel-body" style="margin-top:16px;color:' + escapeHtml(block.style.textColor) + ';">' + escapeHtml(t(block.body, lang)) + '</p>' + renderSimplePanels(block.items, lang) + '</div></div>' + wrapEnd;
      }
      if (block.type === 'faq') {
        return wrapStart + blockHeading(block, lang) + renderFaq(block.items, lang) + wrapEnd;
      }
      if (block.type === 'social' || block.type === 'im') {
        return wrapStart + blockHeading(block, lang) + renderSocial(block.items, lang) + wrapEnd;
      }
      if (block.type === 'exhibition' || block.type === 'logistics') {
        return wrapStart + blockHeading(block, lang) + renderTimeline(block.items, lang) + wrapEnd;
      }
      if (block.type === 'contact') {
        const contactCards = [
          siteState.contact.contactPerson ? '<div class="panel"><strong>Contact</strong><div class="panel-body">' + escapeHtml(siteState.contact.contactPerson) + '</div></div>' : '',
          siteState.contact.email ? '<div class="panel"><strong>Email</strong><div class="panel-body">' + escapeHtml(siteState.contact.email) + '</div></div>' : '',
          siteState.contact.phone ? '<div class="panel"><strong>Phone</strong><div class="panel-body">' + escapeHtml(siteState.contact.phone) + '</div></div>' : '',
          siteState.contact.fax ? '<div class="panel"><strong>Fax</strong><div class="panel-body">' + escapeHtml(siteState.contact.fax) + '</div></div>' : '',
          siteState.contact.address ? '<div class="panel"><strong>Address</strong><div class="panel-body">' + escapeHtml(siteState.contact.address) + '</div></div>' : '',
          siteState.contact.website ? '<div class="panel"><strong>Website</strong><div class="panel-body">' + escapeHtml(siteState.contact.website) + '</div></div>' : ''
        ].filter(Boolean).join('');
        const quickTags = [siteState.brandName, siteState.industry, siteState.brandType, 'Multi-language inquiry', 'Factory direct']
          .filter(Boolean)
          .map(function(value){ return '<span class="chip">' + escapeHtml(value) + '</span>'; })
          .join('');
        return wrapStart + '<div class="contact-layout"><div>' + blockHeading(block, lang) + '<p class="panel-body" style="margin-top:16px;color:' + escapeHtml(block.style.textColor) + ';">' + escapeHtml(t(block.body, lang)) + '</p><div class="contact-meta">' + contactCards + '</div><div class="quick-tags">' + quickTags + '</div></div><div class="contact-card"><div class="contact-form"><input placeholder="Name"><input placeholder="Company"><input placeholder="Email"><input placeholder="Country"><textarea placeholder="Project requirement / product / quantity / language / shipping"></textarea></div><div class="chip-row" style="margin-top:16px;"><span class="chip">Attach drawing</span><span class="chip">Upload catalog</span><span class="chip">Language pack</span></div><div style="margin-top:18px;"><button class="primary-button" style="width:100%;background:' + escapeHtml(block.style.accentColor) + '">' + escapeHtml(t(block.ctaText, lang)) + '</button></div></div></div>' + wrapEnd;
      }
      return '';
    }

    function renderHeader(lang) {
      const visibleBlocks = siteState.blocks.filter(function(block){ return block.visible && block.type !== 'hero'; });
      const customNav = siteState.navigation && siteState.navigation.enabled && Array.isArray(siteState.navigation.items)
        ? siteState.navigation.items.filter(function(item){ return item && item.visible !== false && item.label; })
        : [];
      function resolveNavHref(item) {
        const href = typeof item?.href === 'string' ? item.href.trim() : '';
        const sectionKey = typeof item?.sectionKey === 'string' ? item.sectionKey.trim().replace(/^[/#]+/, '') : '';
        if (!href) return sectionKey ? '?page=' + encodeURIComponent(sectionKey) : '#';
        if (/^(https?:)?\\/\\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
          return href;
        }
        if (href.startsWith('/')) {
          const normalized = href.replace(/^\\/+/, '');
          if (!normalized) return '?page=hero';
          const parts = normalized.split('?');
          return '?page=' + encodeURIComponent(parts[0] || sectionKey || 'hero') + (parts[1] ? '&' + parts[1] : '');
        }
        return href;
      }
      function resolveNavIconMarkup(item) {
        if (item && typeof item.customIconUrl === 'string' && item.customIconUrl.trim()) {
          return '<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex:none;"><img src="' + escapeHtml(item.customIconUrl.trim()) + '" alt="" style="width:16px;height:16px;object-fit:contain;border-radius:4px;"></span>';
        }
        const iconName = item && typeof item.iconName === 'string' ? item.iconName.trim() : '';
        const glyphMap = {
          Navigation: '⌂',
          Package: '◫',
          Blocks: '◧',
          Calendar: '◨',
          Globe2: '◎',
          Building2: '▣',
          Factory: '▤',
          Image: '▥',
          ShieldCheck: '◈',
          HelpCircle: '?',
          Truck: '▭',
          MessageCircle: '◌'
        };
        const glyph = glyphMap[iconName] || '•';
        return '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;flex:none;font-size:12px;line-height:1;opacity:0.86;">' + escapeHtml(glyph) + '</span>';
      }
      function renderNavChildren(items, level) {
        const links = (items || []).filter(function(item){ return item && item.visible !== false && item.label; }).map(function(item){
          const href = resolveNavHref(item);
          const label = item.labels && typeof item.labels === 'object' && item.labels[lang] ? item.labels[lang] : item.label;
          const children = item.children && item.children.length ? '<div class="nav-children">' + renderNavChildren(item.children, level + 1) + '</div>' : '';
          const pageAttribute = href.indexOf('?page=') === 0 ? ' data-site-page="true"' : '';
          return '<a href="' + escapeHtml(href) + '"' + pageAttribute + ' style="display:inline-flex;align-items:center;gap:8px;">' + resolveNavIconMarkup(item) + '<span>' + escapeHtml(label) + '</span></a>' + children;
        }).join('');
        return links;
      }
      function renderNavItem(item) {
        const href = resolveNavHref(item);
        const label = item.labels && typeof item.labels === 'object' && item.labels[lang] ? item.labels[lang] : item.label;
        const children = item.children && item.children.length ? item.children.filter(function(child){ return child && child.visible !== false && child.label; }) : [];
        const dropdown = children.length ? '<div class="nav-dropdown">' + renderNavChildren(children, 1) + '</div>' : '';
        const pageAttribute = href.indexOf('?page=') === 0 ? ' data-site-page="true"' : '';
        return '<div class="nav-item ' + (children.length ? 'has-children' : '') + '"><a href="' + escapeHtml(href) + '"' + pageAttribute + ' style="display:inline-flex;align-items:center;gap:8px;">' + resolveNavIconMarkup(item) + '<span>' + escapeHtml(label) + '</span></a>' + dropdown + '</div>';
      }
      const nav = (customNav.length ? customNav.map(renderNavItem) : visibleBlocks.map(function(block){
        return '<div class="nav-item"><a href="#' + escapeHtml(block.type) + '">' + escapeHtml(routeLabel(block.type, lang)) + '</a></div>';
      })).join('');
      const ctaLabel = siteState.navigation && siteState.navigation.ctaLabel ? siteState.navigation.ctaLabel : 'Get Quote';
      const ctaHref = siteState.navigation && siteState.navigation.ctaHref ? siteState.navigation.ctaHref : '#contact';
      const ctaRoute = ctaHref === '#contact' ? '?page=contact' : (ctaHref.startsWith('/') ? resolveNavHref({ href: ctaHref, sectionKey: 'contact' }) : ctaHref);
      const ctaPageAttribute = ctaRoute.indexOf('?page=') === 0 ? ' data-site-page="true"' : '';
      const currentMeta = window.__langMeta && window.__langMeta[lang] ? window.__langMeta[lang] : { flag: 'GL', nativeLabel: 'English' };
      const langButtons = (siteState.languages || []).map(function(langKey){
        const meta = window.__langMeta && window.__langMeta[langKey] ? window.__langMeta[langKey] : { flag: 'GL', nativeLabel: langKey };
        return '<button type="button" class="language-option ' + (langKey === lang ? 'active' : '') + '" data-lang-key="' + escapeHtml(langKey) + '"><span class="language-flag">' + escapeHtml(meta.flag) + '</span><span class="language-labels"><strong>' + escapeHtml(meta.nativeLabel) + '</strong><span>' + escapeHtml(meta.key || langKey) + '</span></span></button>';
      }).join('');
      const logoHtml = siteState.logoUrl
        ? '<div class="brand-logo" style="background:#fff;padding:4px;"><img src="' + escapeHtml(siteState.logoUrl) + '" alt="' + escapeHtml(siteState.logoAlt || siteState.brandName) + '" style="width:100%;height:100%;object-fit:contain;border-radius:10px;"></div>'
        : '<div class="brand-logo">' + escapeHtml((siteState.brandName || 'M').slice(0, 1)) + '</div>';
      const subText = siteState.brandType ? siteState.industry + ' | ' + siteState.brandType : siteState.industry;
      return '<header class="site-header"><div class="site-header-inner"><div class="brand-wrap">' + logoHtml + '<div><div class="brand-name">' + escapeHtml(siteState.brandName) + '</div><div class="brand-sub">' + escapeHtml(subText) + '</div></div></div><nav class="nav-links">' + nav + '</nav><div class="header-actions"><div class="language-switcher"><button type="button" class="language-trigger" data-language-toggle="true"><span>' + escapeHtml(currentMeta.flag || 'GL') + '</span><span>' + escapeHtml(currentMeta.nativeLabel || 'English') + '</span></button><div class="language-menu ' + (languageMenuOpen ? 'open' : '') + '">' + langButtons + '</div></div><a class="primary-button" href="' + escapeHtml(ctaRoute) + '"' + ctaPageAttribute + '>' + escapeHtml(ctaLabel) + '</a></div></div></header>';
    }

    function renderFooter(lang) {
      const leftText = siteState.footerCopyright || (siteState.brandName + (siteState.companyEnglishName ? ' | ' + siteState.companyEnglishName : ''));
      const rightParts = [siteState.contact.email, siteState.contact.phone, siteState.contact.fax].filter(Boolean);
      return '<footer class="footer"><div class="footer-inner"><div>' + escapeHtml(leftText) + '</div><div>' + escapeHtml(rightParts.join(' | ')) + '</div></div></footer>';
    }

    function sanitizeDisplayText(value, fallback) {
      const text = String(value || '').replace(/\\s+/g, ' ').trim();
      return text || String(fallback || '').trim();
    }

    function normalizeCustomerServiceText(value, fallback) {
      const text = sanitizeDisplayText(value, '').trim();
      if (!text) return fallback;
      if (/[�]/.test(text)) return fallback;
      if (/在线|聊天|请输入|发送|默认|网站|您好|专业|关闭|支持/.test(text)) return fallback;
      return text;
    }

    function getNormalizedCustomerServiceConfig(config) {
      if (!config) return null;
      const avatarName = normalizeCustomerServiceText(config.avatarName, '在线客服');
      const launcherLabel = normalizeCustomerServiceText(config.launcherLabel, '在线聊天客服');
      return {
        ...config,
        avatarName,
        launcherLabel,
        panelTitle: normalizeCustomerServiceText(config.panelTitle, avatarName),
        greeting: normalizeCustomerServiceText(config.greeting, ''),
        inputPlaceholder: normalizeCustomerServiceText(config.inputPlaceholder, '请输入您的需求...'),
        sendLabel: normalizeCustomerServiceText(config.sendLabel, '发送'),
      };
    }

    function getCsAnimationClass() {
      const animation = siteState.customerService && siteState.customerService.animationStyle;
      if (animation === 'float') return 'animate-[float_3.4s_ease-in-out_infinite]';
      if (animation === 'bounce') return 'animate-bounce';
      if (animation === 'glow') return 'animate-pulse shadow-[0_0_24px_rgba(255,255,255,0.35)]';
      if (animation === 'flip-roll' || animation === 'flip') return 'animate-[flip-roll_5s_ease-in-out_infinite]';
      if (animation === 'spin-slow') return 'animate-[spin_10s_linear_infinite]';
      if (animation === 'breathe') return 'animate-[avatar-breathe_3.2s_ease-in-out_infinite]';
      if (animation === 'sway') return 'animate-[avatar-sway_3.6s_ease-in-out_infinite]';
      if (animation === 'heartbeat') return 'animate-[avatar-heartbeat_2.2s_ease-in-out_infinite]';
      if (animation === 'wobble') return 'animate-[avatar-wobble_3s_ease-in-out_infinite]';
      if (animation === 'wave') return 'animate-[avatar-wave_3.8s_ease-in-out_infinite]';
      if (animation === 'tilt') return 'animate-[avatar-tilt_2.8s_ease-in-out_infinite]';
      return 'animate-pulse';
    }

    var csReminderAudio = null;
    var csReminderAudioContext = null;
    var csVoiceAudio = null;
    var customerServiceReminderProfiles = ${JSON.stringify(ALL_CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS)};
    var customerServiceVoiceProfiles = ${JSON.stringify(CUSTOMER_SERVICE_VOICE_PRESETS.map((preset) => ({
      key: preset.key,
      gender: preset.gender,
      rate: preset.rate,
      pitch: preset.pitch,
      searchTokens: preset.searchTokens,
    })))};

    function stopCustomerServiceVoice() {
      try {
        if (csVoiceAudio) {
          csVoiceAudio.pause();
          csVoiceAudio.currentTime = 0;
        }
        if (window.speechSynthesis) window.speechSynthesis.cancel();
      } catch {}
    }

    function playCustomerServiceReminderSound() {
      var cs = getNormalizedCustomerServiceConfig(siteState.customerService);
      if (!cs || cs.soundEnabled === false) return false;
      try {
        var volume = Number(cs.soundVolume == null ? 1 : cs.soundVolume);
        if (volume > 1) volume = volume / 100;
        volume = Math.max(0, Math.min(1, volume));
        if (cs.reminderSoundDataUrl) {
          if (!csReminderAudio) csReminderAudio = new Audio();
          csReminderAudio.src = cs.reminderSoundDataUrl;
          csReminderAudio.currentTime = 0;
          csReminderAudio.volume = volume;
          csReminderAudio.play().catch(function(){});
          return true;
        }

        var profile = customerServiceReminderProfiles.find(function(item){ return item.key === cs.soundStyle; })
          || customerServiceReminderProfiles[0];
        if (profile && profile.localAsset && profile.localAsset.url) {
          if (!csReminderAudio) csReminderAudio = new Audio();
          csReminderAudio.src = profile.localAsset.url;
          csReminderAudio.currentTime = 0;
          csReminderAudio.volume = volume;
          csReminderAudio.play().catch(function(){});
          return true;
        }
        var AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
        if (!profile || !AudioContextConstructor) return false;
        if (!csReminderAudioContext || csReminderAudioContext.state === 'closed') {
          csReminderAudioContext = new AudioContextConstructor();
        }
        if (csReminderAudioContext.state === 'suspended') csReminderAudioContext.resume();
        var now = csReminderAudioContext.currentTime;
        var oscillator = csReminderAudioContext.createOscillator();
        var gain = csReminderAudioContext.createGain();
        oscillator.type = profile.oscillator;
        oscillator.frequency.setValueAtTime(profile.frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(profile.endFrequency, now + profile.duration * 0.62);
        if (profile.detune) oscillator.detune.setValueAtTime(profile.detune, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(profile.volume * volume, now + profile.attack);
        gain.gain.exponentialRampToValueAtTime(0.001, now + profile.duration);
        oscillator.connect(gain);
        gain.connect(csReminderAudioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + profile.duration + 0.01);
        return true;
      } catch {
        return false;
      }
    }

    function speakCustomerServiceText(text) {
      var cs = getNormalizedCustomerServiceConfig(siteState.customerService);
      if (!cs || cs.voiceEnabled === false || !text) return;
      try {
        stopCustomerServiceVoice();
        var profile = customerServiceVoiceProfiles.find(function(item){ return item.key === cs.voiceStyleKey; })
          || customerServiceVoiceProfiles.find(function(item){ return item.gender === cs.voiceGender; })
          || customerServiceVoiceProfiles[0];
        if (cs.uploadedVoiceDataUrl) {
          if (!csVoiceAudio) csVoiceAudio = new Audio();
          csVoiceAudio.src = cs.uploadedVoiceDataUrl;
          csVoiceAudio.currentTime = 0;
          csVoiceAudio.playbackRate = Math.max(0.75, Math.min(1.5, Number(cs.voiceRate || 1.3)));
          csVoiceAudio.play().catch(function(){});
          return true;
        }
        if (window.speechSynthesis && window.SpeechSynthesisUtterance && profile) {
          var utterance = new SpeechSynthesisUtterance(String(text));
          utterance.lang = 'zh-CN';
          utterance.rate = Math.max(0.75, Math.min(1.5, Number(cs.voiceRate || profile.rate || 1)));
          utterance.pitch = Math.max(0.5, Math.min(2, Number(profile.pitch || 1)));
          var voices = window.speechSynthesis.getVoices();
          var bestVoice = null;
          var bestScore = -1;
          voices.forEach(function(voice){
            var searchable = String(voice.name + ' ' + voice.voiceURI + ' ' + voice.lang).toLowerCase();
            var score = /^zh/i.test(voice.lang) ? 40 : 0;
            (profile.searchTokens || []).forEach(function(token, index){
              if (searchable.indexOf(String(token).toLowerCase()) >= 0) score += Math.max(10, 80 - index * 8);
            });
            if (score > bestScore) { bestScore = score; bestVoice = voice; }
          });
          if (bestVoice) utterance.voice = bestVoice;
          window.speechSynthesis.speak(utterance);
          return true;
        }
      } catch {}
      return false;
    }

    function renderCsAvatar(sizeClass) {
      const cs = siteState.customerService;
      if (!cs) return '';
      const media = cs.mediaDataUrl
        ? (cs.mediaKind === 'video'
            ? '<video src="' + escapeHtml(cs.mediaDataUrl) + '" autoplay muted loop playsinline></video>'
            : '<img src="' + escapeHtml(cs.mediaDataUrl) + '" alt="' + escapeHtml(cs.avatarName) + '">')
        : '<div class="cs-avatar-fallback" style="background:' + escapeHtml(cs.avatarColor || siteState.theme.primaryColor) + ';">' + escapeHtml((cs.avatarName || 'CS').slice(0, 2)) + '</div>';
      return '<div class="cs-avatar-shell ' + escapeHtml(sizeClass || '') + ' ' + getCsAnimationClass() + '" style="background:' + escapeHtml(cs.avatarColor || siteState.theme.primaryColor) + ';">' + media + '</div>';
    }

    function renderCustomerService() {
      const cs = getNormalizedCustomerServiceConfig(siteState.customerService);
      if (!cs || cs.enabled === false) return '';
      const assistantName = cs.avatarName || '在线客服';
      const launcherLabel = cs.launcherLabel || '在线聊天客服';
      const greeting = cs.greeting || '无招呼词';
      const panelTitle = cs.panelTitle || assistantName;
      const inputPlaceholder = cs.inputPlaceholder || '请输入您的需求...';
      const sendLabel = cs.sendLabel || '发送';
      const voiceText = cs.voiceEnabled ? '已启用真人朗音' : '在线客服';
      return ''
        + '<div class="cs-widget">'
        +   '<button type="button" class="cs-launcher" data-cs-toggle="true" aria-label="' + escapeHtml(launcherLabel) + '">'
        +     renderCsAvatar('')
        +     '<div class="cs-launcher-copy"><strong>' + escapeHtml(launcherLabel) + '</strong><span>' + escapeHtml(assistantName + ' · ' + voiceText) + '</span></div>'
        +   '</button>'
        +   '<div class="cs-panel is-hidden" data-cs-panel="true">'
        +     '<div class="cs-panel-header">'
        +       '<div class="cs-panel-title">'
        +         renderCsAvatar('')
        +         '<div class="cs-panel-title-copy"><strong>' + escapeHtml(panelTitle) + '</strong><span>' + escapeHtml(cs.voiceEnabled ? '当前前台仅保留真人朗音开启状态' : '欢迎咨询产品、报价、交期与定制') + '</span></div>'
        +       '</div>'
        +       '<button type="button" class="cs-close" data-cs-close="true" aria-label="关闭客服">×</button>'
        +     '</div>'
        +     '<div class="cs-messages" data-cs-messages="true">'
        +       '<div class="cs-message assistant">' + escapeHtml(greeting) + '</div>'
        +     '</div>'
        +     '<div class="cs-panel-body">'
        +       '<div class="cs-panel-actions">'
        +         '<textarea data-cs-input="true" placeholder="' + escapeHtml(inputPlaceholder) + '"></textarea>'
        +         '<button type="button" class="cs-send" data-cs-send="true">' + escapeHtml(sendLabel) + '</button>'
        +       '</div>'
        +       '<div class="cs-hint">网站前台会继承发布时的客服头像、动画、提醒音与文字配置。</div>'
        +     '</div>'
        +   '</div>'
        + '</div>';
    }

    function renderFloating() {
      const imBlock = siteState.blocks.find(function(block){ return block.type === 'im' && block.visible; });
      if (!imBlock) return '';
      const dock = (imBlock.items || []).slice(0, 3).map(function(item){
        return item.value || t(item.title, currentLanguage);
      }).filter(Boolean).join(' | ') || 'WhatsApp | Messenger | Telegram';
      return '<div class="floating-im"><a class="primary-button" href="#contact" style="background:' + escapeHtml(siteState.theme.primaryColor) + '">IM Support</a><div class="floating-box"><div style="font-weight:700;margin-bottom:8px;">Plugin Dock</div><div style="font-size:13px;line-height:1.6;">' + escapeHtml(dock) + '</div></div></div>';
    }

    function renderPage(lang) {
      const pageKey = getCurrentPageKey();
      const blocksForPage = siteState.blocks.filter(function(block){
        if (!block.visible) return false;
        if (pageKey === 'hero') return ['hero', 'products', 'cases', 'news'].indexOf(block.type) >= 0;
        return block.type === pageKey;
      });
      const fallbackBlocks = blocksForPage.length ? blocksForPage : siteState.blocks.filter(function(block){ return block.visible && block.type === 'hero'; });
      const blocksHtml = fallbackBlocks.map(function(block){ return renderBlock(block, lang); }).join('');
      root.innerHTML = '<div class="site-shell">' + renderHeader(lang) + blocksHtml + renderFooter(lang) + renderFloating() + renderCustomerService() + '</div>';
      document.documentElement.lang = lang;
      document.title = (siteState.homepageTitle || siteState.brandName) + ' | ' + routeLabel(pageKey, lang);
    }

    function setLanguage(lang) {
      currentLanguage = lang;
      languageMenuOpen = false;
      renderPage(lang);
    }

    function toggleLanguageMenu() {
      languageMenuOpen = !languageMenuOpen;
      renderPage(currentLanguage);
    }
    document.addEventListener('click', function(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const pageLink = target.closest('a[data-site-page]');
      if (pageLink) {
        event.preventDefault();
        window.history.pushState({}, '', pageLink.getAttribute('href') || '?page=hero');
        renderPage(currentLanguage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const langButton = target.closest('[data-lang-key]');
      if (langButton) {
        const langKey = langButton.getAttribute('data-lang-key');
        if (langKey) {
          setLanguage(langKey);
        }
        return;
      }

      const toggleButton = target.closest('[data-language-toggle]');
      if (toggleButton) {
        toggleLanguageMenu();
        return;
      }

      if (languageMenuOpen && !target.closest('.language-switcher')) {
        languageMenuOpen = false;
        renderPage(currentLanguage);
        return;
      }

      const csToggle = target.closest('[data-cs-toggle]');
      if (csToggle) {
        const panel = document.querySelector('[data-cs-panel]');
        if (panel) {
          const isOpening = panel.classList.contains('is-hidden');
          panel.classList.toggle('is-hidden');
          if (isOpening) playCustomerServiceReminderSound();
        }
        return;
      }

      const csClose = target.closest('[data-cs-close]');
      if (csClose) {
        const panel = document.querySelector('[data-cs-panel]');
        if (panel) panel.classList.add('is-hidden');
        return;
      }

      const csSend = target.closest('[data-cs-send]');
      if (csSend) {
        const input = document.querySelector('[data-cs-input]');
        const messages = document.querySelector('[data-cs-messages]');
        if (!(input instanceof HTMLTextAreaElement) || !messages) return;
        const text = (input.value || '').trim();
        if (!text) return;
        messages.insertAdjacentHTML('beforeend', '<div class="cs-message user">' + escapeHtml(text) + '</div>');
        const reply = '已收到：' + text;
        messages.insertAdjacentHTML('beforeend', '<div class="cs-message assistant">' + escapeHtml(reply) + '</div>');
        input.value = '';
        messages.scrollTop = messages.scrollHeight;
        playCustomerServiceReminderSound();
        speakCustomerServiceText(reply);
        return;
      }
    });
    window.__langMeta = ${JSON.stringify(Object.fromEntries(SUPPORTED_LANGUAGES.map((item) => [item.key, item])))};
    window.addEventListener('popstate', function(){ renderPage(currentLanguage); });
    renderPage(currentLanguage);
  </script>
</body>
</html>`;
}
