/**
 * Newsticker utilities: types, constants, parsing, categorisation.
 * Extracted from Newsticker.tsx for maintainability.
 */
import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  sourceIcon?: string;
  publishedAt: string;
  category: NewsCategory;
  region: "berlin" | "brandenburg" | "both";
  imageUrl?: string;
  sentiment: "positive" | "negative" | "neutral";
}

export type NewsCategory =
  | "markt"
  | "neubau"
  | "politik"
  | "gewerbe"
  | "wohnen"
  | "investment"
  | "stadtentwicklung"
  | "sonstiges";

export const CATEGORY_LABELS: Record<NewsCategory, string> = {
  markt: "Marktberichte",
  neubau: "Neubauprojekte",
  politik: "Mietenpolitik",
  gewerbe: "Gewerbe",
  wohnen: "Wohnen",
  investment: "Investment",
  stadtentwicklung: "Stadtentwicklung",
  sonstiges: "Sonstiges",
};

export const CATEGORY_COLORS: Record<NewsCategory, string> = {
  markt: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  neubau: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  politik: "bg-red-500/10 text-red-600 dark:text-red-400",
  gewerbe: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  wohnen: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  investment: "bg-green-500/10 text-green-600 dark:text-green-400",
  stadtentwicklung: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  sonstiges: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

export const REGION_LABELS: Record<string, string> = {
  berlin: "Berlin",
  brandenburg: "Brandenburg",
  both: "Berlin & Brandenburg",
};

export const BERLIN_DISTRICTS = [
  "Charlottenburg", "Friedrichshain", "Kreuzberg", "Lichtenberg", "Marzahn",
  "Mitte", "Neukölln", "Pankow", "Prenzlauer Berg", "Reinickendorf",
  "Spandau", "Steglitz", "Tempelhof", "Treptow", "Wedding",
] as const;

export const BRANDENBURG_CITIES = [
  "Potsdam", "Cottbus", "Frankfurt/Oder", "Oranienburg", "Bernau",
  "Falkensee", "Eberswalde", "Ludwigsfelde", "Königs Wusterhausen", "Wildau",
  "Schönefeld", "Luckenwalde", "Strausberg", "Fürstenwalde", "Neuruppin",
  "Wittenberge", "Rathenow", "Senftenberg", "Spremberg", "Guben",
  "Forst", "Eisenhüttenstadt", "Schwedt", "Prenzlau", "Templin",
  "Angermünde", "Bad Freienwalde", "Seelow", "Beeskow", "Lübben",
  "Lübbenau", "Herzberg", "Finsterwalde", "Elsterwerda", "Bad Belzig",
  "Brandenburg/Havel", "Werder", "Teltow", "Kleinmachnow", "Stahnsdorf",
  "Blankenfelde", "Mahlow", "Rangsdorf", "Zossen", "Nauen",
  "Henningsdorf", "Velten", "Hohen Neuendorf", "Birkenwerder", "Wandlitz",
] as const;

export const SENTIMENT_CONFIG = {
  positive: { icon: ThumbsUp, label: "Positiv", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  negative: { icon: ThumbsDown, label: "Negativ", color: "text-red-500", bg: "bg-red-500/10" },
  neutral: { icon: Minus, label: "Neutral", color: "text-gray-400", bg: "bg-gray-500/10" },
} as const;

/** Detect which specific city/district is mentioned in a news item */
export function detectCity(title: string, description: string): string | null {
  const text = `${title} ${description}`.toLowerCase();
  for (const d of BERLIN_DISTRICTS) {
    if (text.includes(d.toLowerCase())) return d;
  }
  for (const c of BRANDENBURG_CITIES) {
    const searchTerm = c.includes("/") ? c.split("/")[0].toLowerCase() : c.toLowerCase();
    if (text.includes(searchTerm)) return c;
  }
  return null;
}

/** Categorise news by keywords */
export function categoriseNews(title: string, description: string): NewsCategory {
  const text = `${title} ${description}`.toLowerCase();
  if (/marktbericht|preisentwicklung|immobilienpreise|quadratmeterpreis|mietpreisspiegel|preisindex|statistik|kaufpreise|angebotspreise/.test(text)) return "markt";
  if (/neubau|bauprojekt|bauvorhaben|richtfest|grundsteinlegung|baugenehmigung|wohnungsbau/.test(text)) return "neubau";
  if (/mietendeckel|mietpreisbremse|regulierung|verordnung|gesetz|senat|bezirksamt|politik|koalition/.test(text)) return "politik";
  if (/gewerbe|büro|office|einzelhandel|logistik|gewerbefläche/.test(text)) return "gewerbe";
  if (/investment|transaktion|ankauf|verkauf|portfolio|fonds|rendite|investor/.test(text)) return "investment";
  if (/stadtentwicklung|quartier|infrastruktur|verkehr|bahn|flughafen|ber\b/.test(text)) return "stadtentwicklung";
  if (/wohnung|miete|eigentum|wohnraum|mietwohnung|eigentumswohnung|wohnen/.test(text)) return "wohnen";
  return "sonstiges";
}

const CRIME_BLACKLIST = /polizei|straftat|überfall|raub|\bmord\b|totschlag|\bmesser\b|festnahme|verhaftet|tatverdächtig|kriminalität|wohnungseinbruch|einbruchdiebstahl|diebstahl|brandstiftung|drogenhandel|schüsse|schießerei|leiche|verkehrsunfall|messerattacke|schlägerei|vergewaltigung|körperverletzung/i;

/** Filter out non-economic/crime news */
export function isEconomicallyRelevant(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  if (CRIME_BLACKLIST.test(text)) return false;
  return true;
}

const POSITIVE_KEYWORDS = [
  "steigt", "steigerung", "wachstum", "boom", "rekord", "nachfrage", "positiv",
  "erholung", "gewinn", "chancen", "zunahme", "aufwind", "erfolgreich", "attraktiv",
  "günstig", "bezahlbar", "förderung", "subvention", "entlastung", "investition",
  "neubau", "richtfest", "grundsteinlegung", "ausbau", "modernisierung",
];
const NEGATIVE_KEYWORDS = [
  "sinkt", "rückgang", "krise", "einbruch", "verlust", "mangel", "knappheit",
  "teuer", "unbezahlbar", "leerstand", "insolvenz", "pleite", "stagnation",
  "rückläufig", "negativ", "warnung", "risiko", "problem", "sorge", "angst",
  "mietpreisbremse", "zwangsversteigerung", "abriss", "verbot", "baustopp",
  "enteignung", "mietendeckel", "verschärfung", "belastung",
];

export function detectSentiment(title: string, description: string): "positive" | "negative" | "neutral" {
  const text = `${title} ${description}`.toLowerCase();
  let score = 0;
  for (const kw of POSITIVE_KEYWORDS) { if (text.includes(kw)) score++; }
  for (const kw of NEGATIVE_KEYWORDS) { if (text.includes(kw)) score--; }
  if (score >= 2) return "positive";
  if (score <= -2) return "negative";
  return "neutral";
}

export function detectRegion(title: string, description: string): "berlin" | "brandenburg" | "both" {
  const text = `${title} ${description}`.toLowerCase();
  const hasBerlin = /berlin|charlottenburg|kreuzberg|mitte|neukölln|prenzlauer|friedrichshain|tempelhof|spandau|steglitz|pankow|lichtenberg|treptow|marzahn|reinickendorf|wedding/.test(text);
  const hasBrandenburg = /brandenburg|potsdam|cottbus|frankfurt.*oder|oranienburg|bernau|falkensee|eberswalde|ludwigsfelde|königs.?wusterhausen|wildau|schönefeld|luckenwalde|strausberg|fürstenwalde|neuruppin|wittenberge|rathenow|senftenberg|spremberg|guben|\bforst\b|eisenhüttenstadt|schwedt|\bprenzlau\b|templin|angermünde|bad\s?freienwalde|seelow|beeskow|lübben|lübbenau|herzberg|finsterwalde|elsterwerda|bad\s?belzig|brandenburg.*havel|\bwerder\b|teltow|kleinmachnow|stahnsdorf|blankenfelde|mahlow|rangsdorf|zossen|baruth|jüterbog|\bdahme\b|\bnauen\b|ketzin|henningsdorf|\bvelten\b|hohen\s?neuendorf|birkenwerder|glienicke|mühlenbecker|wandlitz|biesenthal|barnim|oberhavel|havelland|oder.?spree|spree.?neiße|dahme.?spreewald|teltow.?fläming|ostprignitz|prignitz|uckermark|märkisch.?oderland/.test(text);
  if (hasBerlin && hasBrandenburg) return "both";
  if (hasBrandenburg) return "brandenburg";
  return "berlin";
}

/** Reject proxies that return HTML error pages */
export function looksLikeXmlFeed(text: string): boolean {
  const head = text.trimStart().slice(0, 1200).toLowerCase();
  if (!head) return false;
  if (/<!doctype\s+html|<html[\s>]/.test(head)) return false;
  return /<rss[\s>]/.test(head) || /<feed[\s>]/.test(head) || (/\?xml/.test(head) && /<(?:rss|feed)[\s>]/.test(head));
}

/** Parse RSS/Atom XML into NewsItem[] */
export function parseRSSItems(xml: string, source: string, icon: string): NewsItem[] {
  const items: NewsItem[] = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) return [];
    let entries = doc.querySelectorAll("item, entry");
    if (entries.length === 0) {
      const byTag = doc.getElementsByTagName("item");
      if (byTag.length > 0) entries = byTag as unknown as NodeListOf<Element>;
      else {
        const byEntry = doc.getElementsByTagName("entry");
        if (byEntry.length > 0) entries = byEntry as unknown as NodeListOf<Element>;
      }
    }
    entries.forEach((entry) => {
      const title = entry.querySelector("title")?.textContent?.trim() || "";
      const linkEl = entry.querySelector("link");
      const link = (linkEl?.textContent?.trim() || linkEl?.getAttribute("href") || "").trim();
      const guid = entry.querySelector("guid")?.textContent?.trim() || "";
      const articleUrl = link || guid;
      const description = (
        entry.querySelector("description")?.textContent?.trim()
        || entry.querySelector("summary")?.textContent?.trim()
        || entry.querySelector("content")?.textContent?.trim()
        || ""
      ).replace(/<[^>]+>/g, "").slice(0, 300);
      const pubDate = entry.querySelector("pubDate")?.textContent?.trim()
        || entry.querySelector("published")?.textContent?.trim()
        || entry.querySelector("updated")?.textContent?.trim()
        || "";
      const mediaUrl = entry.querySelector("media\\:content, content")?.getAttribute("url")
        || entry.querySelector("enclosure")?.getAttribute("url")
        || undefined;
      const imageUrl = mediaUrl && /\.(jpg|jpeg|png|webp|gif)/i.test(mediaUrl) ? mediaUrl : undefined;
      if (title && articleUrl) {
        try {
          const category = categoriseNews(title, description);
          const region = detectRegion(title, description);
          const sentiment = detectSentiment(title, description);
          const safeId = `${source}-${encodeURIComponent(articleUrl).slice(0, 120)}`;
          let publishedAt: string;
          try {
            publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
            if (publishedAt === "Invalid Date") throw new Error();
          } catch {
            publishedAt = new Date().toISOString();
          }
          items.push({ id: safeId, title, description, url: articleUrl, source, sourceIcon: icon, publishedAt, category, region, imageUrl, sentiment });
        } catch {
          /* skip malformed item */
        }
      }
    });
  } catch {
    /* RSS parse error */
  }
  return items;
}

/** Relative time in German */
export function relativeTimeDE(dateStr: string): string {
  const now = Date.now();
  const parsed = new Date(dateStr).getTime();
  if (isNaN(parsed)) return "";
  const diffMs = now - parsed;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Gerade eben";
  if (mins < 60) return `Vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Gestern";
  if (days < 7) return `Vor ${days} Tagen`;
  if (days < 30) return `Vor ${Math.floor(days / 7)} Wochen`;
  return new Date(dateStr).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}
