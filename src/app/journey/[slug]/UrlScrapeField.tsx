"use client";

import { useState, useTransition } from "react";
import { SparkleIcon } from "@/components/icons";
import { scrapeForStep } from "./actions";

type Field = { name: string; label: string; type?: "text" | "textarea" | "number" | "select" };

const fieldClass =
  "mt-1 w-full rounded-lg border border-[var(--sails-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition-shadow duration-150 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--sails-blue)]/40 focus:border-[var(--sails-blue)]";

/**
 * Renders a `url_scrape` step: a URL input + "Scrape my site" trigger, then
 * an editable form pre-filled from the scrape. Same "never write until the
 * exercise is submitted" contract as AiGenerateField — the edited value
 * flows through the step's normal `answers.<id>` path (Exercise Schema
 * §6/§9, CLAUDE.md rule 5), just fed by a scrape instead of a model call.
 * A failed or skipped scrape leaves the same editable form empty, which
 * degrades to exactly today's manual-entry behavior — no separate error
 * state needed for "couldn't scrape it."
 */
export function UrlScrapeField({
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
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasDraft = Object.keys(value).length > 0;

  function scrape() {
    setError(null);
    startTransition(async () => {
      const result = await scrapeForStep(exerciseSlug, stepId, url);
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

  function skipToManual() {
    onChange(Object.fromEntries(fields.map((f) => [f.name, ""])));
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium text-[var(--foreground)]">{label}</legend>

      {!hasDraft && (
        <div className="mt-2 rounded-xl border border-dashed border-[var(--sails-blue)]/30 bg-[var(--sails-blue-light)]/20 p-3.5">
          <div className="flex items-center gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="yourcompany.com"
              className={fieldClass}
            />
            <button
              type="button"
              onClick={scrape}
              disabled={isPending}
              className="shrink-0 rounded-full bg-[var(--sails-blue)] px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-[var(--sails-navy)] disabled:opacity-50"
            >
              {isPending ? "Reading your site..." : "Scrape my site"}
            </button>
          </div>
          {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
          <button
            type="button"
            onClick={skipToManual}
            className="mt-2 text-xs text-muted underline decoration-dotted hover:text-[var(--foreground)]"
          >
            Skip, I&apos;ll fill this in myself
          </button>
        </div>
      )}

      {hasDraft && (
        <div className="mt-2 flex flex-col gap-2.5 rounded-xl border border-[var(--sails-border)] bg-[var(--background)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <SparkleIcon className="h-3.5 w-3.5 text-[var(--sails-blue)]" />
              {url ? "Pulled from your site — edit anything before you save" : "Edit before you save"}
            </span>
            {url && (
              <button
                type="button"
                onClick={scrape}
                disabled={isPending}
                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--sails-blue)] transition-colors duration-150 hover:bg-[var(--sails-blue-light)] disabled:opacity-50"
              >
                {isPending ? "Reading your site..." : "Re-scrape"}
              </button>
            )}
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
