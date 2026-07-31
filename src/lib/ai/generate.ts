import Anthropic from "@anthropic-ai/sdk";
import { loadPrompts } from "../content/loader";
import { renderTemplate } from "../template";

export type GenerateField = { name: string; label: string };

/**
 * Generates one `ai_generate` step's output via a forced tool call. Mirrors
 * `generateSuggestions`'s shape (same model/prompt-loading conventions) but
 * returns a single object, not an array — `ai_generate` drafts one artifact,
 * `suggest` proposes several candidate rows.
 *
 * A truncated response (max_tokens hit mid-tool-call) previously surfaced as
 * a silently empty result here and in `generateSuggestions` — the model
 * returns a `tool_use` block whose `input` is missing required fields, which
 * would otherwise write a diagnosis nobody actually generated. `stop_reason`
 * is checked explicitly so that class of failure throws instead of writing
 * garbage; the caller (the `ai_generate` server action) turns the throw into
 * a user-visible error via the same return-not-throw convention used
 * elsewhere for Server Actions.
 */
export async function generateContent(opts: {
  promptRef: string;
  context: Record<string, unknown>;
  fields: GenerateField[];
}): Promise<Record<string, string>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI generation isn't configured yet — ask an admin to set ANTHROPIC_API_KEY.");
  }

  const prompt = loadPrompts().find((p) => p.data.prompt_ref === opts.promptRef)?.data;
  if (!prompt) throw new Error(`unknown prompt_ref "${opts.promptRef}"`);

  const body = renderTemplate(prompt.body, { context: opts.context, answers: {} });

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: prompt.model,
    max_tokens: prompt.max_tokens,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: body }],
    tools: [
      {
        name: "submit_generated_content",
        description: "Submit the generated content.",
        input_schema: {
          type: "object",
          properties: Object.fromEntries(
            opts.fields.map((f) => [f.name, { type: "string", description: f.label }])
          ),
          required: opts.fields.map((f) => f.name),
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_generated_content" },
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("The model ran out of room generating this — try again, or ask an admin to raise max_tokens.");
  }

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("model did not return structured content");

  const parsed = toolUse.input as Record<string, string>;
  const missing = opts.fields.filter((f) => !parsed[f.name]);
  if (missing.length > 0) {
    throw new Error(
      `model response was missing required field(s): ${missing.map((f) => f.name).join(", ")}`
    );
  }

  return parsed;
}
