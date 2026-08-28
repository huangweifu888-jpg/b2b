import {
  cloneBuilderState,
  tx,
  type LanguageKey,
  type SiteBlock,
  type SiteBlockItem,
  type SiteBuilderState,
} from "./ai-site-builder";
import {
  cloneWebsiteContentState,
  defaultWebsiteContentState,
  getWebsiteContentState,
  saveWebsiteContentState,
  type WebsiteContentState,
  type WebsiteContentLibraryItem,
  type WebsiteNavigationItem,
  type WebsiteSectionEntry,
} from "./website-content-store";

const LANGUAGES: LanguageKey[] = ["en", "zh", "es", "de"];

function repeatText(value: string) {
  return tx(value, value, value, value);
}

function cloneNavigationItems(items: WebsiteNavigationItem[]): WebsiteNavigationItem[] {
  return items.map((item) => ({
    ...item,
    children: item.children?.length ? cloneNavigationItems(item.children) : undefined,
  }));
}

function sortEntries<T extends { enabled?: boolean; pinned?: boolean; sortOrder?: number | null }>(items: T[]) {
  return [...items]
    .filter((item) => item.enabled !== false)
    .sort((a, b) => {
      const pinnedDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      if (pinnedDiff !== 0) return pinnedDiff;
      return (b.sortOrder || 0) - (a.sortOrder || 0);
    });
}

function makeItem(
  id: string,
  title: string,
  body: string,
  extra?: Partial<SiteBlockItem>
): SiteBlockItem {
  return {
    id,
    title: repeatText(title),
    body: repeatText(body),
    image: extra?.image,
    value: extra?.value,
    link: extra?.link,
  };
}

function summarizeSection(entry: WebsiteSectionEntry) {
  return entry.summary || entry.content || "";
}

function sectionEntriesToItems(entries: WebsiteSectionEntry[]) {
  return sortEntries(entries).map((entry, index) =>
    makeItem(entry.id, entry.title, summarizeSection(entry), {
      image: entry.images[0],
      link: entry.linkUrl || undefined,
      value: entry.sortOrder ? `NO.${entry.sortOrder}` : index === 0 && entry.pinned ? "TOP" : undefined,
    })
  );
}

function contentLibraryToItems(entries: WebsiteContentLibraryItem[]) {
  return sortEntries(entries).map((entry, index) =>
    makeItem(entry.id, entry.title, entry.summary || entry.content, {
      image: entry.images[0],
      link: entry.linkUrl || entry.videoUrl || undefined,
      value: entry.publishedAt || (index === 0 && entry.pinned ? "TOP" : undefined),
    })
  );
}

function faqToItems(content: WebsiteContentState) {
  return sortEntries(content.faq).map((item, index) =>
    makeItem(item.id, item.question, item.answer || item.summary, {
      link: item.linkName || undefined,
      value: item.sortOrder ? String(item.sortOrder) : String(index + 1),
    })
  );
}

function socialToItems(content: WebsiteContentState) {
  return sortEntries(content.social.links).map((item) =>
    makeItem(item.id, item.platform, item.url, {
      link: item.url || undefined,
    })
  );
}

function imToItems(content: WebsiteContentState) {
  return sortEntries(content.im.channels).map((item) =>
    makeItem(item.id, item.platform, item.account, {
      link: item.linkUrl || undefined,
    })
  );
}

function firstBanner(content: WebsiteContentState) {
  return sortEntries(content.banner.items)[0] || null;
}

function firstSection(entries: WebsiteSectionEntry[]) {
  return sortEntries(entries)[0] || null;
}

function pickProfileValue(...values: Array<string | undefined>) {
  return values.map((item) => item?.trim()).find(Boolean) || "";
}

export function applyWebsiteContentToBlock(
  block: SiteBlock,
  content = cloneWebsiteContentState(defaultWebsiteContentState)
) {
  const next = cloneBuilderState(block);
  const heroBanner = firstBanner(content);

  if (next.type === "hero" && heroBanner) {
    next.title = repeatText(heroBanner.title);
    next.subtitle = repeatText(heroBanner.summary || content.profile.businessType);
    next.body = repeatText(
      `${pickProfileValue(content.profile.companyName, content.profile.companyEnglishName)} | ${content.profile.businessType} | ${pickProfileValue(content.profile.mainMarkets, content.profile.markets)}`
    );
    next.image = heroBanner.images[0] || next.image;
  }

  if (next.type === "company") {
    const entry = firstSection(content.sections.about);
    if (entry) {
      next.title = repeatText(entry.title);
      next.subtitle = repeatText(entry.summary || content.profile.companyName);
      next.body = repeatText(entry.content || entry.summary);
      next.image = entry.images[0] || next.image;
    }
    next.items = sectionEntriesToItems(content.sections.about);
  }

  if (next.type === "cases") {
    next.items = contentLibraryToItems(content.contentLibrary.cases.items);
  }

  if (next.type === "news") {
    next.items = contentLibraryToItems(content.contentLibrary.news.items);
  }

  if (next.type === "videos") {
    next.items = contentLibraryToItems(content.contentLibrary.videos.items);
  }

  if (next.type === "blog") {
    next.items = contentLibraryToItems(content.contentLibrary.blog.items);
  }

  if (next.type === "factory") {
    const entry = firstSection(content.sections.factory);
    if (entry) {
      next.title = repeatText(entry.title);
      next.subtitle = repeatText(entry.summary || "Factory capability");
      next.body = repeatText(entry.content || entry.summary);
      next.image = entry.images[0] || next.image;
    }
    next.items = sectionEntriesToItems(content.sections.factory);
  }

  if (next.type === "gallery") {
    const entry = firstSection(content.sections.gallery);
    if (entry) {
      next.title = repeatText(entry.title);
      next.subtitle = repeatText(entry.summary || "Gallery");
      next.body = repeatText(entry.content || entry.summary);
    }
    next.items = sectionEntriesToItems(content.sections.gallery);
  }

  if (next.type === "exhibition") {
    const entry = firstSection(content.sections.exhibition);
    if (entry) {
      next.title = repeatText(entry.title);
      next.subtitle = repeatText(entry.summary || "Exhibition");
      next.body = repeatText(entry.content || entry.summary);
    }
    next.items = sectionEntriesToItems(content.sections.exhibition);
  }

  if (next.type === "service") {
    const entry = firstSection(content.sections.service);
    if (entry) {
      next.title = repeatText(entry.title);
      next.subtitle = repeatText(entry.summary || "Service support");
      next.body = repeatText(entry.content || entry.summary);
      next.image = entry.images[0] || next.image;
    }
    next.items = sectionEntriesToItems(content.sections.service);
  }

  if (next.type === "logistics") {
    const entry = firstSection(content.sections.logistics);
    if (entry) {
      next.title = repeatText(entry.title);
      next.subtitle = repeatText(entry.summary || "Logistics");
      next.body = repeatText(entry.content || entry.summary);
    }
    next.items = sectionEntriesToItems(content.sections.logistics);
  }

  if (next.type === "faq") {
    next.items = faqToItems(content);
  }

  if (next.type === "im") {
    next.body = repeatText(`${content.im.onlineHours} / Auto reply: ${content.im.autoReply}`);
    next.items = imToItems(content);
    next.visible = content.im.showFloatingWidget || next.visible;
  }

  if (next.type === "social") {
    next.items = socialToItems(content);
  }

  if (next.type === "contact") {
    next.title = repeatText(`Contact ${content.profile.companyName}`);
    next.body = repeatText(
      `Contact person: ${pickProfileValue(content.profile.contactPerson, content.profile.contactName)} / Phone: ${content.profile.phone} / Email: ${content.profile.email}`
    );
    next.ctaText = repeatText("Send Inquiry");
  }

  return next;
}

export function applyWebsiteContentToBuilderState(
  state: SiteBuilderState,
  content = cloneWebsiteContentState(defaultWebsiteContentState)
) {
  const next = cloneBuilderState(state);
  const companyName = content.profile.companyName?.trim();

  next.contact = {
    ...next.contact,
    email: content.profile.email || next.contact.email,
    phone: content.profile.phone || next.contact.phone,
    address: content.profile.officeAddress || content.profile.factoryAddress || next.contact.address,
    whatsapp: content.im.channels.find((item) => item.enabled)?.account || content.profile.phone || next.contact.whatsapp,
    website: content.profile.website || next.contact.website,
    contactPerson: pickProfileValue(content.profile.contactPerson, content.profile.contactName) || next.contact.contactPerson,
    fax: content.profile.fax || next.contact.fax,
  };

  if (companyName) {
    next.brandName = companyName;
    if (!next.siteName?.trim()) next.siteName = companyName;
  }

  next.companyEnglishName = pickProfileValue(content.profile.companyEnglishName, content.profile.companyName) || next.companyEnglishName;
  next.homepageTitle = pickProfileValue(content.profile.homepageTitle, content.profile.companyName) || next.homepageTitle;
  next.logoUrl = content.profile.logoUrl || next.logoUrl;
  next.logoAlt = content.profile.logoAlt || next.logoAlt;
  next.faviconUrl = content.profile.faviconUrl || next.faviconUrl;
  next.footerCopyright = content.profile.footerCopyright || next.footerCopyright;
  next.brandType = content.profile.brandType || next.brandType;
  next.industry = content.profile.businessType || next.industry;
  next.navigation = {
    enabled: content.navigation.enabled,
    items: cloneNavigationItems(content.navigation.items),
    ctaLabel: content.navigation.ctaLabel,
    ctaHref: content.navigation.ctaHref,
  };
  next.languages = next.languages.length ? next.languages : [...LANGUAGES];
  next.blocks = next.blocks.map((block) => applyWebsiteContentToBlock(block, content));
  return next;
}

function readPrimaryText(item: SiteBlockItem) {
  return item.title.zh || item.title.en || "";
}

function readBodyText(item: SiteBlockItem) {
  return item.body.zh || item.body.en || "";
}

function makeSectionFromBlockItem(item: SiteBlockItem, fallbackTitle: string): WebsiteSectionEntry {
  return {
    id: item.id,
    title: readPrimaryText(item) || fallbackTitle,
    linkUrl: item.link || "",
    summary: readBodyText(item),
    images: item.image ? [item.image] : [],
    content: readBodyText(item),
    pinned: item.value === "TOP",
    enabled: true,
    translationStatus: "translated",
    sortOrder: item.value && /^\d+$/.test(item.value) ? Number(item.value) : null,
  };
}

export function syncBlockToWebsiteContentStore(block: SiteBlock, siteId?: string | null) {
  const content = getWebsiteContentState(siteId);

  switch (block.type) {
    case "hero": {
      const current = content.banner.items[0];
      content.banner.items = [
        {
          id: current?.id || "banner_main",
          title: block.title.zh || block.title.en || current?.title || "首页横幅",
          linkUrl: block.ctaLink || current?.linkUrl || "#contact",
          summary: block.subtitle.zh || block.subtitle.en || block.body?.zh || block.body?.en || "",
          images: block.image ? [block.image] : current?.images || [],
          pinned: true,
          enabled: true,
          translationStatus: "translated",
          showTextOverlay: true,
          mobileOnly: false,
          sortOrder: 100,
        },
      ];
      break;
    }
    case "cases":
    case "news":
    case "videos":
    case "blog": {
      const key = block.type;
      content.contentLibrary[key].items = block.items.map((item, index) => ({
        ...makeSectionFromBlockItem(item, key === "cases" ? "Case" : key === "news" ? "News" : key === "videos" ? "Video" : "Blog"),
        categoryId: "",
        publishedAt: new Date().toISOString().slice(0, 10),
        metaTitle: readPrimaryText(item),
        metaDescription: readBodyText(item),
        keywords: "",
        videoUrl: key === "videos" ? item.link || "" : "",
        pinned: index === 0,
      }));
      break;
    }
    case "company":
      content.sections.about = block.items.length
        ? block.items.map((item) => makeSectionFromBlockItem(item, "公司介绍"))
        : [
            {
              id: "about_main",
              title: block.title.zh || block.title.en || "公司介绍",
              linkUrl: "",
              summary: block.subtitle.zh || block.subtitle.en || "",
              images: block.image ? [block.image] : [],
              content: block.body?.zh || block.body?.en || "",
              pinned: true,
              enabled: true,
              translationStatus: "translated",
              sortOrder: 100,
            },
          ];
      break;
    case "factory":
      content.sections.factory = block.items.map((item) => makeSectionFromBlockItem(item, "工厂生产"));
      break;
    case "gallery":
      content.sections.gallery = block.items.map((item) => makeSectionFromBlockItem(item, "公司风采"));
      break;
    case "exhibition":
      content.sections.exhibition = block.items.map((item) => makeSectionFromBlockItem(item, "展会活动"));
      break;
    case "service":
      content.sections.service = block.items.map((item) => makeSectionFromBlockItem(item, "服务保障"));
      break;
    case "logistics":
      content.sections.logistics = block.items.map((item) => makeSectionFromBlockItem(item, "物流货运"));
      break;
    case "faq":
      content.faq = block.items.map((item, index) => ({
        id: item.id,
        question: readPrimaryText(item),
        linkName: item.link || "",
        summary: readBodyText(item),
        answer: readBodyText(item),
        pinned: index === 0,
        enabled: true,
        translationStatus: "translated",
        sortOrder: index + 1,
      }));
      break;
    case "im":
      content.im.channels = block.items.map((item) => ({
        id: item.id,
        platform: readPrimaryText(item),
        account: readBodyText(item),
        linkUrl: item.link || "",
        enabled: true,
        sortOrder: null,
      }));
      if (block.body) {
        const body = block.body.zh || block.body.en || "";
        content.im.autoReply = body;
      }
      break;
    case "social":
      content.social.links = block.items.map((item) => ({
        id: item.id,
        platform: readPrimaryText(item),
        url: item.link || readBodyText(item),
        enabled: true,
        sortOrder: null,
      }));
      break;
    case "contact": {
      if (block.body) {
        const text = block.body.zh || block.body.en || "";
        const contactMatch = text.match(/(?:Contact person)[:：]?\s*([^/|]+)/i);
        const phoneMatch = text.match(/(?:Phone|电话)[:：]?\s*([^/|]+)/i);
        const emailMatch = text.match(/(?:Email|邮箱)[:：]?\s*([^/|]+)/i);
        if (contactMatch) content.profile.contactPerson = contactMatch[1].trim();
        if (phoneMatch) content.profile.phone = phoneMatch[1].trim();
        if (emailMatch) content.profile.email = emailMatch[1].trim();
      }
      break;
    }
    default:
      return;
  }

  saveWebsiteContentState(content, siteId);
}
