import type { AIBuilderScope } from "./ai-builder-route-scope";

export { getAIBuilderScope } from "./ai-builder-route-scope";
export type { AIBuilderScope } from "./ai-builder-route-scope";

export const SUPPORTED_LANGUAGES = [
  { key: "en", flag: "\uD83C\uDDFA\uD83C\uDDF8", countryCode: "US", label: "English", nativeLabel: "English" },
  { key: "ru", flag: "\uD83C\uDDF7\uD83C\uDDFA", countryCode: "RU", label: "Russian", nativeLabel: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439" },
  { key: "da", flag: "\uD83C\uDDE9\uD83C\uDDF0", countryCode: "DK", label: "Danish", nativeLabel: "Dansk" },
  { key: "uk", flag: "\uD83C\uDDFA\uD83C\uDDE6", countryCode: "UA", label: "Ukrainian", nativeLabel: "\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430" },
  { key: "ur", flag: "\uD83C\uDDF5\uD83C\uDDF0", countryCode: "PK", label: "Urdu", nativeLabel: "\u0627\u0631\u062F\u0648" },
  { key: "bg", flag: "\uD83C\uDDE7\uD83C\uDDEC", countryCode: "BG", label: "Bulgarian", nativeLabel: "\u0411\u044A\u043B\u0433\u0430\u0440\u0441\u043A\u0438" },
  { key: "hr", flag: "\uD83C\uDDED\uD83C\uDDF7", countryCode: "HR", label: "Croatian", nativeLabel: "Hrvatski" },
  { key: "is", flag: "\uD83C\uDDEE\uD83C\uDDF8", countryCode: "IS", label: "Icelandic", nativeLabel: "\u00CDslenska" },
  { key: "ca", flag: "\uD83C\uDFF3\uFE0F", countryCode: "ES-CA", label: "Catalan", nativeLabel: "Catal\u00E0" },
  { key: "hu", flag: "\uD83C\uDDED\uD83C\uDDFA", countryCode: "HU", label: "Hungarian", nativeLabel: "Magyar" },
  { key: "hi", flag: "\uD83C\uDDEE\uD83C\uDDF3", countryCode: "IN", label: "Hindi", nativeLabel: "\u0939\u093F\u0928\u094D\u0926\u0940" },
  { key: "kn", flag: "\uD83C\uDDEE\uD83C\uDDF3", countryCode: "IN-KN", label: "Kannada", nativeLabel: "\u0C95\u0CA8\u0CCD\u0CA8\u0CA1" },
  { key: "id", flag: "\uD83C\uDDEE\uD83C\uDDE9", countryCode: "ID", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
  { key: "gu", flag: "\uD83C\uDDEE\uD83C\uDDF3", countryCode: "IN-GU", label: "Gujarati", nativeLabel: "\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0" },
  { key: "tr", flag: "\uD83C\uDDF9\uD83C\uDDF7", countryCode: "TR", label: "Turkish", nativeLabel: "T\u00FCrk\u00E7e" },
  { key: "sr", flag: "\uD83C\uDDF7\uD83C\uDDF8", countryCode: "RS", label: "Serbian", nativeLabel: "\u0421\u0440\u043F\u0441\u043A\u0438" },
  { key: "bn", flag: "\uD83C\uDDE7\uD83C\uDDE9", countryCode: "BD", label: "Bengali", nativeLabel: "\u09AC\u09BE\u0982\u09B2\u09BE" },
  { key: "he", flag: "\uD83C\uDDEE\uD83C\uDDF1", countryCode: "IL", label: "Hebrew", nativeLabel: "\u05E2\u05D1\u05E8\u05D9\u05EA" },
  { key: "el", flag: "\uD83C\uDDEC\uD83C\uDDF7", countryCode: "GR", label: "Greek", nativeLabel: "\u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC" },
  { key: "de", flag: "\uD83C\uDDE9\uD83C\uDDEA", countryCode: "DE", label: "German", nativeLabel: "Deutsch" },
  { key: "it", flag: "\uD83C\uDDEE\uD83C\uDDF9", countryCode: "IT", label: "Italian", nativeLabel: "Italiano" },
  { key: "lv", flag: "\uD83C\uDDF1\uD83C\uDDFB", countryCode: "LV", label: "Latvian", nativeLabel: "Latvie\u0161u" },
  { key: "no", flag: "\uD83C\uDDF3\uD83C\uDDF4", countryCode: "NO", label: "Norwegian", nativeLabel: "Norsk" },
  { key: "cs", flag: "\uD83C\uDDE8\uD83C\uDDFF", countryCode: "CZ", label: "Czech", nativeLabel: "\u010Ce\u0161tina" },
  { key: "sk", flag: "\uD83C\uDDF8\uD83C\uDDF0", countryCode: "SK", label: "Slovak", nativeLabel: "Sloven\u010Dina" },
  { key: "sl", flag: "\uD83C\uDDF8\uD83C\uDDEE", countryCode: "SI", label: "Slovenian", nativeLabel: "Sloven\u0161\u010Dina" },
  { key: "pa", flag: "\uD83C\uDDEE\uD83C\uDDF3", countryCode: "IN-PA", label: "Punjabi", nativeLabel: "\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40" },
  { key: "ja", flag: "\uD83C\uDDEF\uD83C\uDDF5", countryCode: "JP", label: "Japanese", nativeLabel: "\u65E5\u672C\u8A9E" },
  { key: "fr", flag: "\uD83C\uDDEB\uD83C\uDDF7", countryCode: "FR", label: "French", nativeLabel: "Fran\u00E7ais" },
  { key: "pl", flag: "\uD83C\uDDF5\uD83C\uDDF1", countryCode: "PL", label: "Polish", nativeLabel: "Polski" },
  { key: "fa", flag: "\uD83C\uDDEE\uD83C\uDDF7", countryCode: "IR", label: "Persian", nativeLabel: "\u0641\u0627\u0631\u0633\u06CC" },
  { key: "te", flag: "\uD83C\uDDEE\uD83C\uDDF3", countryCode: "IN-TE", label: "Telugu", nativeLabel: "\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41" },
  { key: "ta", flag: "\uD83C\uDDEE\uD83C\uDDF3", countryCode: "IN-TA", label: "Tamil", nativeLabel: "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD" },
  { key: "th", flag: "\uD83C\uDDF9\uD83C\uDDED", countryCode: "TH", label: "Thai", nativeLabel: "\u0E44\u0E17\u0E22" },
  { key: "et", flag: "\uD83C\uDDEA\uD83C\uDDEA", countryCode: "EE", label: "Estonian", nativeLabel: "Eesti" },
  { key: "sv", flag: "\uD83C\uDDF8\uD83C\uDDEA", countryCode: "SE", label: "Swedish", nativeLabel: "Svenska" },
  { key: "lt", flag: "\uD83C\uDDF1\uD83C\uDDF9", countryCode: "LT", label: "Lithuanian", nativeLabel: "Lietuvi\u0173" },
  { key: "zh", flag: "\uD83C\uDDE8\uD83C\uDDF3", countryCode: "CN", label: "Simplified Chinese", nativeLabel: "\u7B80\u4F53\u4E2D\u6587" },
  { key: "zh-tw", flag: "\uD83C\uDDF9\uD83C\uDDFC", countryCode: "TW", label: "Traditional Chinese", nativeLabel: "\u7E41\u9AD4\u4E2D\u6587" },
  { key: "ro", flag: "\uD83C\uDDF7\uD83C\uDDF4", countryCode: "RO", label: "Romanian", nativeLabel: "Rom\u00E2n\u0103" },
  { key: "fi", flag: "\uD83C\uDDEB\uD83C\uDDEE", countryCode: "FI", label: "Finnish", nativeLabel: "Suomi" },
  { key: "nl", flag: "\uD83C\uDDF3\uD83C\uDDF1", countryCode: "NL", label: "Dutch", nativeLabel: "Nederlands" },
  { key: "fil", flag: "\uD83C\uDDF5\uD83C\uDDED", countryCode: "PH", label: "Filipino", nativeLabel: "Filipino" },
  { key: "pt", flag: "\uD83C\uDDF5\uD83C\uDDF9", countryCode: "PT", label: "Portuguese", nativeLabel: "Portugu\u00EAs" },
  { key: "es", flag: "\uD83C\uDDEA\uD83C\uDDF8", countryCode: "ES", label: "Spanish", nativeLabel: "Espa\u00F1ol" },
  { key: "vi", flag: "\uD83C\uDDFB\uD83C\uDDF3", countryCode: "VN", label: "Vietnamese", nativeLabel: "Ti\u1EBFng Vi\u1EC7t" },
  { key: "ar", flag: "\uD83C\uDDF8\uD83C\uDDE6", countryCode: "SA", label: "Arabic", nativeLabel: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629" },
  { key: "ko", flag: "\uD83C\uDDF0\uD83C\uDDF7", countryCode: "KR", label: "Korean", nativeLabel: "\uD55C\uAD6D\uC5B4" },
  { key: "mr", flag: "\uD83C\uDDEE\uD83C\uDDF3", countryCode: "IN-MR", label: "Marathi", nativeLabel: "\u092E\u0930\u093E\u0920\u0940" },
  { key: "ml", flag: "\uD83C\uDDEE\uD83C\uDDF3", countryCode: "IN-ML", label: "Malayalam", nativeLabel: "\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02" },
  { key: "ms", flag: "\uD83C\uDDF2\uD83C\uDDFE", countryCode: "MY", label: "Malay", nativeLabel: "Bahasa Melayu" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["key"];

export function getClientRoutePrefix(pathname: string) {
  if (pathname.startsWith("/zb/client-source")) return "/zb/client-source";
  if (pathname.startsWith("/dl/kh")) return "/dl/kh";
  if (pathname.startsWith("/zb/kh")) return "/zb/kh";
  if (pathname.startsWith("/kh")) return "/kh";
  return "";
}

export function resolveClientRoute(pathname: string, route: string) {
  const prefix = getClientRoutePrefix(pathname);
  if (route === "/") return prefix || "/";
  return `${prefix}${route}`;
}

export function getAIBuilderStorageKeys(scope: AIBuilderScope) {
  const prefix = `ai-builder:${scope}`;
  return {
    html: `${prefix}:html`,
    state: `${prefix}:state`,
    templateId: `${prefix}:template-id`,
    templateMeta: `${prefix}:template-meta`,
  };
}

export function getLanguageMeta(language: SupportedLanguage) {
  return SUPPORTED_LANGUAGES.find((item) => item.key === language) || null;
}

export function getLanguageDisplayLabel(language: SupportedLanguage) {
  const meta = getLanguageMeta(language);
  if (!meta) return language.toUpperCase();
  return `${meta.flag} ${meta.nativeLabel}`;
}

export function getDefaultTemplateLanguages(): SupportedLanguage[] {
  return SUPPORTED_LANGUAGES.map((item) => item.key);
}
