"use client";

import { useState, useTransition } from "react";
import { SparkleIcon } from "@/components/icons";
import { generateForStep } from "./actions";

type Field = { name: string; label: string; type?: "text" | "textarea" | "number" | "select" };

const fieldClass =
  "mt-1 w-full rounded-lg border border-[var(--sails-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition-shadow duration-150 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--sails-blue)]/40 focus:border-[var(--sails-blue)]";

/**
 * Renders an `ai_generate` step: a "Generate" trigger, then an editable form
 * pre-filled with the model's draft. Nothing writes until the exercise is
 * submitted — the edited value flows through the step's normal `answers.<id>`
 * path, same as any manually-typed step (Exercise Schema §6/§9, CLAUDE.md
 * rule 5: AI output is always routed through an editable field first).
 */
export function AiGenerateField({
  exerciseSlug,
  stepId,
  label,
  fields,
  value,
  onChange,
}: {
  exerciseSlug: string;
  stepId: string;
  label: string;
  fields: Field[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasDraft = Object.keys(value).length > 0;

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateForStep(exerciseSlug, stepId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onChange(result.content);
    });
  }

  function updateField(name: string, v: string) {
    onChange({ ...value, [name]: v });
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium text-[var(--foreground)]">{label}</legend>

      {!hasDraft && (
        <div className="mt-2 rounded-xl border border-dashed border-[var(--sails-blue)]/30 bg-[var(--sails-blue-light)]/20 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted">
              <SparkleIcon className="h-4 w-4 shrink-0 text-[var(--sails-blue)]" />
              Nothing generated yet — review before this saves anywhere.
            </div>
            <button
              type="button"
              onClick={generate}
              disabled={isPending}
              className="shrink-0 rounded-full bg-[var(--sails-blue)] px-3 py-1 text-xs font-medium text-white transition-colors duration-150 hover:bg-[var(--sails-navy)] disabled:opacity-50"
            >
              {isPending ? "Thinking..." : "Generate"}
            </button>
          </div>
          {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
        </div>
      )}

      {hasDraft && (
        <div className="mt-2 flex flex-col gap-2.5 rounded-xl border border-[var(--sails-border)] bg-[var(--background)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <SparkleIcon className="h-3.5 w-3.5 text-[var(--sails-blue)]" />
              Generated draft — edit anything before you save
            </span>
            <button
              type="button"
              onClick={generate}
              disabled={isPending}
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--sails-blue)] transition-colors duration-150 hover:bg-[var(--sails-blue-light)] disabled:opacity-50"
            >
              {isPending ? "Thinking..." : "Regenerate"}
            </button>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          {fields.map((f) => (
            <label key={f.name} className="block">
              <span className="text-xs font-medium text-muted">{f.label}</span>
              {f.type === "textarea" ? (
                <textarea
                  value={value[f.name] ?? ""}
                  onChange={(e) => updateField(f.name, e.target.value)}
                  rows={3}
                  className={fieldClass}
                />
              ) : (
                <input
                  value={value[f.name] ?? ""}
                  onChange={(e) => updateField(f.name, e.target.value)}
                  className={fieldClass}
                />
              )}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
