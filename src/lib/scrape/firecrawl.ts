/**
 * Firecrawl `/v2/scrape` with a `json`-format schema does the fetch and the
 * structured extraction in one call, so there's no separate "scrape raw
 * markdown, then run our own AI extraction pass" step to keep in sync.
 * Verified live against the real API (docs.firecrawl.dev/features/scrape)
 * before wiring this in.
 *
 * `data.metadata` comes back on every scrape regardless of which `formats`
 * were requested (confirmed live, not just from docs) — theme-color and
 * og:image/favicon are structural page metadata, not content a schema-guided
 * extraction reads off the page text, so known brand field names are
 * special-cased to pull from there instead of asking the model for them.
 */
const METADATA_FIELD_SOURCES: Record<string, (metadata: Record<string, unknown>) => string> = {
  brand_primary_color: (m) => (typeof m["theme-color"] === "string" ? (m["theme-color"] as string) : ""),
  brand_logo_url: (m) =>
    typeof m.ogImage === "string" ? (m.ogImage as string) : typeof m.favicon === "string" ? (m.favicon as string) : "",
};

export async function scrapeAndExtract(opts: {
  url: string;
  fields: { name: string; label: string }[];
}): Promise<Record<string, string>> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Scraping isn't configured yet — ask an admin to set FIRECRAWL_API_KEY.");
  }

  const schemaFields = opts.fields.filter((f) => !(f.name in METADATA_FIELD_SOURCES));
  const metadataFields = opts.fields.filter((f) => f.name in METADATA_FIELD_SOURCES);

  const formats: unknown[] = ["markdown"]; // ensures data.metadata is populated even if schemaFields is empty
  if (schemaFields.length > 0) {
    formats.push({
      type: "json",
      schema: {
        type: "object",
        properties: Object.fromEntries(schemaFields.map((f) => [f.name, { type: "string", description: f.label }])),
        required: schemaFields.map((f) => f.name),
      },
    });
  }

  let res: Response;
  try {
    res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: opts.url, formats }),
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
    data?: { json?: Record<string, unknown>; metadata?: Record<string, unknown> };
  };
  if (!body.success || !body.data) {
    throw new Error("Couldn't extract anything useful from that page — try a different URL or fill this in manually.");
  }

  const parsed: Record<string, string> = {};
  const rawJson = body.data.json ?? {};
  for (const f of schemaFields) {
    const v = rawJson[f.name];
    parsed[f.name] = typeof v === "string" ? v : "";
  }
  const metadata = body.data.metadata ?? {};
  for (const f of metadataFields) {
    parsed[f.name] = METADATA_FIELD_SOURCES[f.name](metadata);
  }
  return parsed;
}
