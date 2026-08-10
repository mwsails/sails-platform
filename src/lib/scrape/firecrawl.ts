/**
 * Firecrawl `/v2/scrape` with a `json`-format schema does the fetch and the
 * structured extraction in one call, so there's no separate "scrape raw
 * markdown, then run our own AI extraction pass" step to keep in sync.
 * Verified live against the real API (docs.firecrawl.dev/features/scrape)
 * before wiring this in.
 */
export async function scrapeAndExtract(opts: {
  url: string;
  fields: { name: string; label: string }[];
}): Promise<Record<string, string>> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Scraping isn't configured yet — ask an admin to set FIRECRAWL_API_KEY.");
  }

  const schema = {
    type: "object",
    properties: Object.fromEntries(opts.fields.map((f) => [f.name, { type: "string", description: f.label }])),
    required: opts.fields.map((f) => f.name),
  };

  let res: Response;
  try {
    res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: opts.url, formats: [{ type: "json", schema }] }),
    });
  } catch {
    throw new Error("Couldn't reach the scraper — check the URL and try again, or fill this in manually.");
  }

  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Scraping isn't configured correctly — ask an admin to check the API key."
        : "Couldn't scrape that page — check the URL and try again, or fill this in manually."
    );
  }

  const body = (await res.json()) as { success?: boolean; data?: { json?: Record<string, unknown> } };
  if (!body.success || !body.data?.json) {
    throw new Error("Couldn't extract anything useful from that page — try a different URL or fill this in manually.");
  }

  const raw = body.data.json;
  const parsed: Record<string, string> = {};
  for (const f of opts.fields) {
    const v = raw[f.name];
    parsed[f.name] = typeof v === "string" ? v : "";
  }
  return parsed;
}

const NEAR_BLACK_OR_WHITE = new Set([
  "#000",
  "#000000",
  "#fff",
  "#ffffff",
  "#111",
  "#111111",
  "#222",
  "#222222",
  "#333",
  "#333333",
]);

export type BrandKit = {
  logo: string;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  font_heading: string;
  font_body: string;
};

/**
 * Best-effort brand-kit proposal from a page's HTML + Firecrawl metadata —
 * a pure function, not a fetch, so it can run against the same response
 * scrapeBusinessProfile below already has, no second API call needed.
 * Deliberately not the same contract as scrapeAndExtract above. That
 * function does LLM-structured extraction of text Firecrawl's `json`
 * format reads from rendered content; there's no equivalent for real hex
 * colors or font-family names, since those live in CSS, not page copy, and
 * most sites link an external stylesheet rather than inline one (verified
 * live against sailsadvisory.com and stripe.com before writing this — both
 * returned zero <style>/<link> tags in Firecrawl's `html` format, and
 * neither exposed reliable inline font-family declarations).
 *
 * So this proposes only what's genuinely observable:
 * - logo: metadata.ogImage, falling back to metadata.favicon. Both are
 *   already-hosted image URLs — captured as a string, not uploaded, since
 *   this app has no file storage (see org.brand.* namespace comment).
 * - color_primary: metadata['theme-color'] when a site declares one
 *   (common but not universal — present on sailsadvisory.com, absent on
 *   stripe.com in testing).
 * - color_secondary/color_accent: the next two most frequent distinct hex
 *   codes appearing anywhere in the raw HTML (inline styles, SVGs, etc.),
 *   excluding near-black/near-white noise. Genuinely heuristic — verified
 *   against stripe.com that this surfaces a real brand color (#5d64fe, its
 *   actual purple) among the noise, not just decoration, but it's a guess
 *   same as any other scraped field: reviewed and corrected on screen, not
 *   trusted blindly.
 * - font_heading/font_body: left blank. No test site gave any usable
 *   signal for these — proposing a fake guess would violate "propose,
 *   don't assume" harder than leaving an honest blank to fill in.
 */
export function extractBrandKit(html: string, metadata: Record<string, unknown>): BrandKit {
  const logo =
    (typeof metadata.ogImage === "string" && metadata.ogImage) ||
    (typeof metadata.favicon === "string" && metadata.favicon) ||
    "";

  const themeColor = typeof metadata["theme-color"] === "string" ? (metadata["theme-color"] as string) : "";
  const isHex = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/;

  const hexCounts = new Map<string, number>();
  for (const match of html.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
    const hex = match[0].toLowerCase();
    if (NEAR_BLACK_OR_WHITE.has(hex)) continue;
    hexCounts.set(hex, (hexCounts.get(hex) ?? 0) + 1);
  }
  const byFrequency = [...hexCounts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);

  const colorPrimary = isHex.test(themeColor) ? themeColor : (byFrequency[0] ?? "");
  const remaining = byFrequency.filter((hex) => hex !== colorPrimary);

  return {
    logo,
    color_primary: colorPrimary,
    color_secondary: remaining[0] ?? "",
    color_accent: remaining[1] ?? "",
    font_heading: "",
    font_body: "",
  };
}

const TARGET_INDUSTRY_FIELD = "target_industry";
const TARGET_INDUSTRY_DESCRIPTION =
  "The primary industry or type of customer this company sells to, if the page clearly states or implies it " +
  "(e.g. \"B2B fintech companies\", \"healthcare providers\", \"e-commerce brands\"). Leave as an empty string if " +
  "the page doesn't make this clear — do not guess.";

/**
 * Business bucket's single scrape — one Firecrawl call requesting both the
 * `json` (LLM text-field extraction, same as scrapeAndExtract) and `html`
 * (for extractBrandKit) formats together, confirmed live that Firecrawl
 * returns both from one request rather than needing two round trips (and
 * two credits) for what the Business screen shows as a single review card.
 *
 * Also proposes a target-industry guess (who the company sells to, not
 * what it is) via the same json extraction — but deliberately kept out of
 * `business`/`opts.fields`: it isn't a field the Business screen shows or
 * saves, it's carried forward by OnboardingFlow to pre-fill Who You Sell
 * To when the rep reaches it later. Not required in the schema, unlike
 * every other requested field — most pages don't say this explicitly, and
 * a forced guess here would be exactly the "propose a fake answer" failure
 * mode extractBrandKit's fonts avoid.
 */
export async function scrapeBusinessProfile(opts: {
  url: string;
  fields: { name: string; label: string }[];
}): Promise<{ business: Record<string, string>; brand: BrandKit; targetIndustry: string }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Scraping isn't configured yet — ask an admin to set FIRECRAWL_API_KEY.");
  }

  const schema = {
    type: "object",
    properties: {
      ...Object.fromEntries(opts.fields.map((f) => [f.name, { type: "string", description: f.label }])),
      [TARGET_INDUSTRY_FIELD]: { type: "string", description: TARGET_INDUSTRY_DESCRIPTION },
    },
    required: opts.fields.map((f) => f.name),
  };

  let res: Response;
  try {
    res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: opts.url, formats: [{ type: "json", schema }, { type: "html" }] }),
    });
  } catch {
    throw new Error("Couldn't reach the scraper — check the URL and try again, or fill this in manually.");
  }

  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Scraping isn't configured correctly — ask an admin to check the API key."
        : "Couldn't scrape that page — check the URL and try again, or fill this in manually."
    );
  }

  const body = (await res.json()) as {
    success?: boolean;
    data?: { json?: Record<string, unknown>; html?: string; metadata?: Record<string, unknown> };
  };
  if (!body.success || !body.data?.json) {
    throw new Error("Couldn't extract anything useful from that page — try a different URL or fill this in manually.");
  }

  const raw = body.data.json;
  const business: Record<string, string> = {};
  for (const f of opts.fields) {
    const v = raw[f.name];
    business[f.name] = typeof v === "string" ? v : "";
  }
  const targetIndustry = typeof raw[TARGET_INDUSTRY_FIELD] === "string" ? (raw[TARGET_INDUSTRY_FIELD] as string) : "";

  const brand = extractBrandKit(body.data.html ?? "", body.data.metadata ?? {});

  return { business, brand, targetIndustry };
}
