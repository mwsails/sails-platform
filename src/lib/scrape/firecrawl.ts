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
