import { getDomain } from "tldts";

// Cleans up a user-typed domain entry into a bare hostname: strips any
// protocol, path/query/hash, and a leading "www.", lowercases the result.
// "https://www.youtube.com/watch?v=1" → "youtube.com". Used anywhere a user
// types domains into a text field (planner tasks, routines, always-blocked
// list in Settings) — the extension's own matching only ever works against
// bare hostnames, so unnormalized entries (a pasted full URL) silently never
// match anything.
export function normalizeDomainInput(raw: string): string {
  let v = (raw ?? "").trim().toLowerCase();
  if (!v) return "";
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // strip protocol, e.g. "https://"
  v = v.split(/[/?#]/)[0] ?? ""; // strip path/query/hash
  v = v.replace(/^www\./, "");
  return v;
}

// Returns the registrable root domain: "gist.github.com" → "github.com".
//
// Backed by the real Public Suffix List (via tldts) rather than a hand-
// rolled allowlist of "two-part TLDs" — the old version only recognized a
// handful of English-speaking-market ccTLDs (co.uk, com.au, com.br, co.in,
// co.nz, co.za, org.uk, net.au, org.au, me.uk, gov.uk, ac.uk). Any domain on
// a public-suffix TLD outside that set (co.jp, com.mx, co.id, and dozens
// more) got mis-rooted to just the ccTLD itself ("example.co.jp" →
// "co.jp"), merging every unrelated site on that ccTLD into one fake "Co Jp"
// brand for category grouping, favicons, and display names — a systematic
// bug for a large non-{US,UK,AU,BR,IN,NZ,ZA} audience, not an edge case.
//
// NOTE: this stays a pure registrable-domain function — category overrides
// (lib/categories.ts) are keyed off it. Cross-brand grouping lives in the
// domain-family layer below.
export function getRootDomain(domain: string): string {
  const bare = domain.replace(/^www\./, "");
  // tldts returns null for inputs with no recognized public suffix (bare
  // hostnames like "localhost", intranet names, raw IPs) — fall back to the
  // input itself rather than propagating null, matching this function's
  // existing always-returns-a-string contract.
  return getDomain(bare) ?? bare;
}

// ── Domain families ──────────────────────────────────────────────────────────
//
// A "family" is a brand that spans one or more *registrable* domains and/or
// needs a clean display label. `getRootDomain` already merges subdomains of one
// registrable domain (gist.github.com → github.com), but it can never merge two
// different registrable domains (github.com vs githubusercontent.com) — that's
// what this layer is for. It also fixes brand capitalisation that the generic
// heuristic gets wrong ("Github" → "GitHub", "Linkedin" → "LinkedIn").
//
// `canonical` is the registrable domain used for the favicon and category
// lookup. `domains` lists every registrable domain that belongs to the family;
// each one is indexed in FAMILY_BY_ROOT below.

interface DomainFamily {
  key: string;        // stable grouping key
  label: string;      // human display name
  canonical: string;  // representative registrable domain (favicon + category)
  domains: string[];  // registrable domains that belong to this family
}

const DOMAIN_FAMILIES: DomainFamily[] = [
  // ── Multi-domain brands (the cross-registrable-domain case) ────────────────
  { key: "github",   label: "GitHub",    canonical: "github.com",    domains: ["github.com", "githubusercontent.com", "github.io", "githubassets.com", "ghcr.io"] },
  { key: "gitlab",   label: "GitLab",    canonical: "gitlab.com",    domains: ["gitlab.com", "gitlab.io"] },
  { key: "google",   label: "Google",    canonical: "google.com",    domains: ["google.com", "googleusercontent.com", "gstatic.com", "googleapis.com", "withgoogle.com", "goo.gl"] },
  { key: "youtube",  label: "YouTube",   canonical: "youtube.com",   domains: ["youtube.com", "youtu.be", "ytimg.com", "googlevideo.com", "yt.be"] },
  { key: "microsoft",label: "Microsoft", canonical: "microsoft.com", domains: ["microsoft.com", "microsoftonline.com", "office.com", "office365.com", "sharepoint.com", "msftauth.net"] },
  { key: "x",        label: "X (Twitter)", canonical: "x.com",       domains: ["x.com", "twitter.com", "t.co", "twimg.com"] },
  { key: "reddit",   label: "Reddit",    canonical: "reddit.com",    domains: ["reddit.com", "redd.it", "redditstatic.com", "redditmedia.com"] },
  { key: "linkedin", label: "LinkedIn",  canonical: "linkedin.com",  domains: ["linkedin.com", "licdn.com", "lnkd.in"] },
  { key: "facebook", label: "Facebook",  canonical: "facebook.com",  domains: ["facebook.com", "fb.com", "fbcdn.net", "fb.me"] },
  { key: "instagram",label: "Instagram", canonical: "instagram.com", domains: ["instagram.com", "cdninstagram.com", "ig.me"] },
  { key: "whatsapp", label: "WhatsApp",  canonical: "whatsapp.com",  domains: ["whatsapp.com", "whatsapp.net", "wa.me"] },
  { key: "netflix",  label: "Netflix",   canonical: "netflix.com",   domains: ["netflix.com", "nflximg.com", "nflxvideo.net", "nflxext.com"] },
  { key: "twitch",   label: "Twitch",    canonical: "twitch.tv",     domains: ["twitch.tv", "ttvnw.net", "jtvnw.net"] },
  { key: "spotify",  label: "Spotify",   canonical: "spotify.com",   domains: ["spotify.com", "scdn.co", "spotifycdn.com"] },
  { key: "stackoverflow", label: "Stack Overflow", canonical: "stackoverflow.com", domains: ["stackoverflow.com", "sstatic.net"] },
  { key: "openai",   label: "OpenAI",    canonical: "openai.com",    domains: ["openai.com", "chatgpt.com", "oaistatic.com", "oaiusercontent.com"] },
  { key: "claude",   label: "Claude",    canonical: "claude.ai",     domains: ["claude.ai", "anthropic.com", "claudeusercontent.com"] },
  { key: "notion",   label: "Notion",    canonical: "notion.so",     domains: ["notion.so", "notion.site", "notion.com", "notion-static.com"] },
  { key: "slack",    label: "Slack",     canonical: "slack.com",     domains: ["slack.com", "slack-edge.com", "slackb.com"] },
  { key: "discord",  label: "Discord",   canonical: "discord.com",   domains: ["discord.com", "discordapp.com", "discord.gg", "discordapp.net", "discord.media"] },
  { key: "zoom",     label: "Zoom",      canonical: "zoom.us",       domains: ["zoom.us", "zoomgov.com"] },
  { key: "wikipedia",label: "Wikipedia", canonical: "wikipedia.org", domains: ["wikipedia.org", "wikimedia.org", "wikidata.org"] },
  { key: "amazon",   label: "Amazon",    canonical: "amazon.com",    domains: ["amazon.com", "media-amazon.com", "ssl-images-amazon.com"] },
  { key: "atlassian",label: "Atlassian", canonical: "atlassian.net", domains: ["atlassian.net", "atlassian.com"] },

  // ── Brand-label corrections (single registrable domain) ────────────────────
  { key: "npm",          label: "npm",          canonical: "npmjs.com",       domains: ["npmjs.com"] },
  { key: "hackernews",   label: "Hacker News",  canonical: "ycombinator.com", domains: ["ycombinator.com"] },
  { key: "producthunt",  label: "Product Hunt", canonical: "producthunt.com", domains: ["producthunt.com"] },
  { key: "devto",        label: "DEV",          canonical: "dev.to",          domains: ["dev.to"] },
  { key: "tiktok",       label: "TikTok",       canonical: "tiktok.com",      domains: ["tiktok.com", "tiktokcdn.com"] },
  { key: "codepen",      label: "CodePen",      canonical: "codepen.io",      domains: ["codepen.io"] },
  { key: "codesandbox",  label: "CodeSandbox",  canonical: "codesandbox.io",  domains: ["codesandbox.io"] },
  { key: "leetcode",     label: "LeetCode",     canonical: "leetcode.com",    domains: ["leetcode.com"] },
  { key: "huggingface",  label: "Hugging Face", canonical: "huggingface.co",  domains: ["huggingface.co"] },
  { key: "freecodecamp", label: "freeCodeCamp", canonical: "freecodecamp.org",domains: ["freecodecamp.org"] },
  { key: "mdn",          label: "MDN",          canonical: "developer.mozilla.org", domains: ["developer.mozilla.org"] },
];

const FAMILY_BY_ROOT: Map<string, DomainFamily> = (() => {
  const m = new Map<string, DomainFamily>();
  for (const fam of DOMAIN_FAMILIES) {
    for (const d of fam.domains) m.set(d, fam);
  }
  return m;
})();

// Generic display-name heuristic for domains with no curated family:
// "my-site.co.uk" → "My Site". Used as the fallback for both getSiteName and
// getDomainFamily so the two never disagree.
function fallbackName(domain: string): string {
  // The brand is the first label of the registrable root, so multi-part TLDs
  // resolve correctly ("my-blog.co.uk" → "My Blog", not "Co").
  const root = getRootDomain(domain);
  const brand = root.split(".")[0] || root;
  return brand.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Resolves a domain to its family. Known brands (incl. cross-registrable-domain
// ones) return the curated family; everything else falls back to its
// registrable root so generic subdomain grouping still works.
export function getDomainFamily(domain: string): { key: string; label: string; canonical: string } {
  const root = getRootDomain(domain);
  const fam = FAMILY_BY_ROOT.get(root);
  if (fam) return { key: fam.key, label: fam.label, canonical: fam.canonical };
  return { key: root, label: fallbackName(root), canonical: root };
}

// Groups domain rows by family — merging subdomains AND sibling brand domains
// (github.com + raw.githubusercontent.com → "GitHub"), summing seconds/visits.
// `rootDomain` is the family's canonical domain (favicon + category lookup) and
// is kept as the field name for backward compatibility with existing callers.
export function groupByRootDomain<T extends { domain: string; totalSeconds: number; visits: number }>(
  rows: T[]
): Array<{ rootDomain: string; label: string; key: string; totalSeconds: number; visits: number; subdomains: T[] }> {
  const map = new Map<string, { rootDomain: string; label: string; totalSeconds: number; visits: number; subdomains: T[] }>();
  for (const row of rows) {
    const fam = getDomainFamily(row.domain);
    const cur = map.get(fam.key) ?? { rootDomain: fam.canonical, label: fam.label, totalSeconds: 0, visits: 0, subdomains: [] };
    cur.totalSeconds += row.totalSeconds;
    cur.visits += row.visits;
    cur.subdomains.push(row);
    map.set(fam.key, cur);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);
}

// Clean display name for a domain — uses the curated brand label when known
// ("github.com" → "GitHub"), otherwise a generic heuristic ("My Site").
export function getSiteName(domain: string): string {
  const fam = FAMILY_BY_ROOT.get(getRootDomain(domain));
  return fam ? fam.label : fallbackName(domain);
}

// Every registrable domain that belongs to `domain`'s family, e.g.
// "github.com" → ["github.com", "githubusercontent.com", "github.io", ...].
// Falls back to the domain's own registrable root for uncurated brands.
// Used to build a precise match set (exact root, or a genuine subdomain of
// one) instead of an unanchored substring match — an unanchored `ilike`
// against "github.com" would also match an unrelated domain that merely
// *ends with* that string, like "evilgithub.com".
export function getFamilyDomains(domain: string): string[] {
  const root = getRootDomain(domain);
  const fam = FAMILY_BY_ROOT.get(root);
  return fam ? fam.domains : [root];
}
