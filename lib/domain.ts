// Returns the registrable root domain: "gist.github.com" → "github.com".
// Handles common two-part TLDs (co.uk, com.au, etc.) and leaves plain
// "domain.tld" untouched.
export function getRootDomain(domain: string): string {
  const parts = domain.replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  // Two-part TLDs like co.uk, com.au, org.uk, net.au…
  const twoPartTLDs = new Set(["co.uk","com.au","com.br","co.in","co.nz","co.za","org.uk","net.au","org.au","me.uk","gov.uk","ac.uk"]);
  const lastTwo = parts.slice(-2).join(".");
  if (twoPartTLDs.has(lastTwo)) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

// Groups an array of domain rows by root domain, summing seconds and visits.
// The representative favicon domain is the root domain itself.
export function groupByRootDomain<T extends { domain: string; totalSeconds: number; visits: number }>(
  rows: T[]
): Array<{ rootDomain: string; totalSeconds: number; visits: number; subdomains: T[] }> {
  const map = new Map<string, { totalSeconds: number; visits: number; subdomains: T[] }>();
  for (const row of rows) {
    const root = getRootDomain(row.domain);
    const cur = map.get(root) ?? { totalSeconds: 0, visits: 0, subdomains: [] };
    cur.totalSeconds += row.totalSeconds;
    cur.visits += row.visits;
    cur.subdomains.push(row);
    map.set(root, cur);
  }
  return Array.from(map.entries())
    .map(([rootDomain, v]) => ({ rootDomain, ...v }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);
}

export function getSiteName(domain: string, pageTitle?: string): string {
  const cleanDomain = domain.replace(/^www\./, "");
  const domainParts = cleanDomain.split(".");
  const rootName = domainParts.length > 2 ? domainParts[domainParts.length - 2] : domainParts[0];

  if (pageTitle && pageTitle !== cleanDomain && pageTitle !== domain) {
    const parts = pageTitle.split(/\s[\|\-·—–]\s/).map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      const genericNames = [
        "home",
        "about",
        "blog",
        "resources",
        "dashboard",
        "welcome",
        "docs",
        "support",
        "help",
        "account",
        "settings",
        "login",
        "sign in",
        "sign up",
      ];
      const isGeneric = (value: string) => {
        const normalized = value.toLowerCase();
        return genericNames.some((generic) =>
          normalized === generic || normalized.startsWith(`${generic} `) || normalized.endsWith(` ${generic}`)
        );
      };

      const domainRegex = new RegExp(rootName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const matchingPart = parts.find((part) => domainRegex.test(part));
      if (matchingPart && matchingPart.length <= 60) return matchingPart;

      const first = parts[0];
      const last = parts[parts.length - 1];
      if (!isGeneric(last) && last.length <= 60) return last;
      if (!isGeneric(first) && first.length <= 60) return first;

      const best = parts.find((part) => !isGeneric(part) && part.length <= 60);
      if (best) return best;
    }

    if (pageTitle.length <= 60) return pageTitle;
  }

  const candidate = cleanDomain.split(".").slice(-2, -1)[0] ?? cleanDomain.split(".")[0] ?? cleanDomain;
  return candidate.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
