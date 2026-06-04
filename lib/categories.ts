import { getRootDomain } from "./domain";

export type CategoryId =
  | "focus"
  | "social"
  | "entertainment"
  | "comms"
  | "news"
  | "productivity"
  | "shopping"
  | "other";

export interface CategoryDef {
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  focus:         { label: "Deep Work",     color: "#7C3AED", bgClass: "bg-violet-500/15",  textClass: "text-violet-300",  borderClass: "border-violet-500/25"  },
  social:        { label: "Social",        color: "#EC4899", bgClass: "bg-pink-500/15",    textClass: "text-pink-300",    borderClass: "border-pink-500/25"    },
  entertainment: { label: "Entertainment", color: "#F59E0B", bgClass: "bg-amber-500/15",   textClass: "text-amber-300",   borderClass: "border-amber-500/25"   },
  comms:         { label: "Comms",         color: "#3B82F6", bgClass: "bg-blue-500/15",    textClass: "text-blue-300",    borderClass: "border-blue-500/25"    },
  news:          { label: "News",          color: "#06B6D4", bgClass: "bg-cyan-500/15",    textClass: "text-cyan-300",    borderClass: "border-cyan-500/25"    },
  productivity:  { label: "Productivity",  color: "#10B981", bgClass: "bg-emerald-500/15", textClass: "text-emerald-300", borderClass: "border-emerald-500/25" },
  shopping:      { label: "Shopping",      color: "#F97316", bgClass: "bg-orange-500/15",  textClass: "text-orange-300",  borderClass: "border-orange-500/25"  },
  other:         { label: "Other",         color: "#64748B", bgClass: "bg-slate-500/10",   textClass: "text-slate-400",   borderClass: "border-slate-500/20"   },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];

// Well-known domain → category defaults.
// Specific subdomains are checked before root domain so e.g.
// mail.google.com → comms even if google.com would map differently.
const DEFAULT_MAP: Record<string, CategoryId> = {
  // ── Deep Work ──────────────────────────────────────────────────────────────
  "github.com":          "focus",
  "gitlab.com":          "focus",
  "bitbucket.org":       "focus",
  "stackoverflow.com":   "focus",
  "stackexchange.com":   "focus",
  "superuser.com":       "focus",
  "askubuntu.com":       "focus",
  "figma.com":           "focus",
  "vercel.com":          "focus",
  "supabase.com":        "focus",
  "npmjs.com":           "focus",
  "codepen.io":          "focus",
  "jsfiddle.net":        "focus",
  "replit.com":          "focus",
  "codesandbox.io":      "focus",
  "leetcode.com":        "focus",
  "hackerrank.com":      "focus",
  "kaggle.com":          "focus",
  "huggingface.co":      "focus",
  "cursor.so":           "focus",
  "anthropic.com":       "focus",
  "openai.com":          "focus",
  "perplexity.ai":       "focus",
  "developer.apple.com": "focus",
  "developer.android.com": "focus",
  "developer.mozilla.org": "focus",
  "w3schools.com":       "focus",

  // ── Social ──────────────────────────────────────────────────────────────────
  "twitter.com":         "social",
  "x.com":               "social",
  "instagram.com":       "social",
  "linkedin.com":        "social",
  "reddit.com":          "social",
  "facebook.com":        "social",
  "tiktok.com":          "social",
  "pinterest.com":       "social",
  "snapchat.com":        "social",
  "threads.net":         "social",
  "bsky.app":            "social",
  "tumblr.com":          "social",

  // ── Entertainment ──────────────────────────────────────────────────────────
  "youtube.com":         "entertainment",
  "netflix.com":         "entertainment",
  "twitch.tv":           "entertainment",
  "spotify.com":         "entertainment",
  "hulu.com":            "entertainment",
  "primevideo.com":      "entertainment",
  "disneyplus.com":      "entertainment",
  "soundcloud.com":      "entertainment",
  "crunchyroll.com":     "entertainment",
  "imdb.com":            "entertainment",
  "letterboxd.com":      "entertainment",
  "9gag.com":            "entertainment",
  "imgur.com":           "entertainment",
  "bandcamp.com":        "entertainment",

  // ── Communication ──────────────────────────────────────────────────────────
  "gmail.com":              "comms",
  "mail.google.com":        "comms",
  "meet.google.com":        "comms",
  "chat.google.com":        "comms",
  "hangouts.google.com":    "comms",
  "outlook.com":            "comms",
  "outlook.live.com":       "comms",
  "outlook.office.com":     "comms",
  "office.com":             "comms",
  "live.com":               "comms",
  "slack.com":              "comms",
  "discord.com":            "comms",
  "zoom.us":                "comms",
  "whatsapp.com":           "comms",
  "telegram.org":           "comms",
  "t.me":                   "comms",
  "skype.com":              "comms",
  "teams.microsoft.com":    "comms",
  "microsoftteams.com":     "comms",

  // ── News ───────────────────────────────────────────────────────────────────
  "ycombinator.com":        "news",
  "bbc.com":                "news",
  "bbc.co.uk":              "news",
  "cnn.com":                "news",
  "nytimes.com":            "news",
  "theguardian.com":        "news",
  "washingtonpost.com":     "news",
  "techcrunch.com":         "news",
  "theverge.com":           "news",
  "wired.com":              "news",
  "medium.com":             "news",
  "substack.com":           "news",
  "producthunt.com":        "news",
  "dev.to":                 "news",
  "hashnode.dev":           "news",
  "lobste.rs":              "news",
  "arstechnica.com":        "news",
  "zdnet.com":              "news",

  // ── Productivity ───────────────────────────────────────────────────────────
  "notion.so":              "productivity",
  "trello.com":             "productivity",
  "asana.com":              "productivity",
  "monday.com":             "productivity",
  "linear.app":             "productivity",
  "clickup.com":            "productivity",
  "airtable.com":           "productivity",
  "docs.google.com":        "productivity",
  "drive.google.com":       "productivity",
  "sheets.google.com":      "productivity",
  "slides.google.com":      "productivity",
  "calendar.google.com":    "productivity",
  "obsidian.md":            "productivity",
  "roamresearch.com":       "productivity",
  "miro.com":               "productivity",
  "confluence.atlassian.net": "productivity",
  "jira.atlassian.net":     "productivity",

  // ── Shopping ───────────────────────────────────────────────────────────────
  "amazon.com":             "shopping",
  "amazon.co.uk":           "shopping",
  "amazon.in":              "shopping",
  "ebay.com":               "shopping",
  "etsy.com":               "shopping",
  "aliexpress.com":         "shopping",
  "walmart.com":            "shopping",
  "target.com":             "shopping",
  "bestbuy.com":            "shopping",
  "shopify.com":            "shopping",
};

/**
 * Returns the CategoryId for a given domain.
 * Lookup order: user override (by root) → default for specific subdomain →
 * default for root domain → "other".
 */
export function getCategoryForDomain(
  domain: string,
  overrides: Record<string, CategoryId> = {}
): CategoryId {
  const root = getRootDomain(domain);
  return (
    overrides[root] ??
    DEFAULT_MAP[domain] ??
    DEFAULT_MAP[root] ??
    "other"
  );
}

/**
 * Aggregates an array of domain rows into per-category totals,
 * sorted by seconds descending, with zeros excluded.
 */
export function getCategoryStats(
  domains: Array<{ domain: string; total_seconds: number }>,
  overrides: Record<string, CategoryId> = {}
): Array<CategoryDef & { id: CategoryId; seconds: number }> {
  const map = new Map<CategoryId, number>();
  for (const d of domains) {
    const cat = getCategoryForDomain(d.domain, overrides);
    map.set(cat, (map.get(cat) ?? 0) + d.total_seconds);
  }
  return Array.from(map.entries())
    .filter(([, seconds]) => seconds > 0)
    .map(([id, seconds]) => ({ id, ...CATEGORIES[id], seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}

/** Converts a 6-digit hex color to [r, g, b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
