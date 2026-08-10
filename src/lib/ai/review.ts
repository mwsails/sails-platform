import Anthropic from "@anthropic-ai/sdk";
import { loadPrompts } from "../content/loader";
import { renderTemplate } from "../template";

/**
 * Runs one `ai_review` step's critique via a forced tool call. Mirrors
 * generateContent's shape, but returns a single free-text critique, not a
 * set of named fields — an ai_review step never writes to context (Exercise
 * Schema §9: it "never writes to context itself"), so there is no form
 * shape to round-trip into, just prose to render read-only.
 *
 * `answers` carries the CURRENT (possibly unsaved) value of the step being
 * reviewed, keyed by that step's id — e.g. `{ impact_areas: [...] }` for
 * `{{answers.impact_areas}}` in the prompt body. This has to come from the
 * caller, not readContext: the step under review has not been submitted
 * yet, so its value only exists in the exercise form's own in-memory state.
 */
export async function reviewContent(opts: {
  promptRef: string;
  context: Record<string, unknown>;
  answers: Record<string, unknown>;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI review isn't configured yet — ask an admin to set ANTHROPIC_API_KEY.");
  }

  const prompt = loadPrompts().find((p) => p.data.prompt_ref === opts.promptRef)?.data;
  if (!prompt) throw new Error(`unknown prompt_ref "${opts.promptRef}"`);

  const body = renderTemplate(prompt.body, { context: opts.context, answers: opts.answers });

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: prompt.model,
    max_tokens: prompt.max_tokens,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: body }],
    tools: [
      {
        name: "submit_review",
        description: "Submit the critique.",
        input_schema: {
          type: "object",
          properties: {
            critique: { type: "string", description: "The review, in plain prose." },
          },
          required: ["critique"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_review" },
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("The model ran out of room writing this review — try again, or ask an admin to raise max_tokens.");
  }

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("model did not return a structured review");

  const critique = (toolUse.input as { critique?: unknown }).critique;
  if (typeof critique !== "string" || critique.trim() === "") {
    throw new Error("model response was missing the critique");
  }

  return critique;
}
