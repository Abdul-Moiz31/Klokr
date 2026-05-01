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
