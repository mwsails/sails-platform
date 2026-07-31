import Anthropic from "@anthropic-ai/sdk";
import { loadPrompts } from "../content/loader";
import { renderTemplate } from "../template";

export type SuggestField = { name: string; label: string };

/**
 * Generates `count` structured suggestions for a list-shaped step (Exercise
 * Schema `suggest` extension) via a forced tool call — not free-form prose —
 * so the result round-trips straight into the step's own row shape with no
 * parsing. No thinking/effort tuning beyond `effort: "low"`: this is a quick
 * brainstorm, not a reasoning-heavy task.
 */
export async function generateSuggestions(opts: {
  promptRef: string;
  count: number;
  context: Record<string, unknown>;
  existing: Record<string, string>[];
  fields: SuggestField[];
}): Promise<Record<string, string>[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI suggestions aren't configured yet — ask an admin to set ANTHROPIC_API_KEY.");
  }

  const prompt = loadPrompts().find((p) => p.data.prompt_ref === opts.promptRef)?.data;
  if (!prompt) throw new Error(`unknown prompt_ref "${opts.promptRef}"`);

  const body = renderTemplate(prompt.body, {
    context: opts.context,
    answers: { existing: opts.existing, count: opts.count },
  });

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: prompt.model,
    max_tokens: prompt.max_tokens,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: body }],
    tools: [
      {
        name: "submit_suggestions",
        description: "Submit the suggested items.",
        input_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: Object.fromEntries(
                  opts.fields.map((f) => [f.name, { type: "string", description: f.label }])
                ),
                required: opts.fields.map((f) => f.name),
              },
            },
          },
          required: ["suggestions"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_suggestions" },
  });

  // A truncated response (max_tokens hit mid-tool-call) previously fell
  // through to `parsed.suggestions ?? []` below and silently returned an
  // empty list, indistinguishable from "the model genuinely had nothing to
  // suggest." Checked explicitly so the panel shows a real error instead —
  // see generate.ts's doc comment, this is the same failure class.
  if (response.stop_reason === "max_tokens") {
    throw new Error("The model ran out of room generating suggestions — try again, or ask an admin to raise max_tokens.");
  }

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("model did not return structured suggestions");

  const parsed = toolUse.input as { suggestions: Record<string, string>[] };
  return (parsed.suggestions ?? []).slice(0, opts.count);
}
