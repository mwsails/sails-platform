"use client";

import { useState, useTransition } from "react";
import { SparkleIcon, PlusIcon, CheckCircleIcon } from "@/components/icons";
import { suggestForStep } from "./actions";

type Field = { name: string; label: string };

export function AiSuggestPanel({
  exerciseSlug,
  stepId,
  fields,
  existingItems,
  onAdd,
}: {
  exerciseSlug: string;
  stepId: string;
  fields: Field[];
  existingItems: Record<string, string>[];
  onAdd: (item: Record<string, string>) => void;
}) {
  const [suggestions, setSuggestions] = useState<Record<string, string>[] | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function fetchSuggestions() {
    setError(null);
    startTransition(async () => {
      const result = await suggestForStep(exerciseSlug, stepId, existingItems);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSuggestions(result.suggestions);
      setAdded(new Set());
    });
  }

  return (
    <div className="rounded-xl border border-dashed border-[var(--sails-blue)]/30 bg-[var(--sails-blue-light)]/20 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
          <SparkleIcon className="h-4 w-4 shrink-0 text-[var(--sails-blue)]" />
          AI suggestions
        </div>
        <button
          type="button"
          onClick={fetchSuggestions}
          disabled={isPending}
          className="shrink-0 rounded-full bg-[var(--sails-blue)] px-3 py-1 text-xs font-medium text-white transition-colors duration-150 hover:bg-[var(--sails-navy)] disabled:opacity-50"
        >
          {isPending ? "Thinking..." : suggestions ? "Get more" : "Get AI suggestions"}
        </button>
      </div>

      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}

      {suggestions && suggestions.length === 0 && !error && (
        <p className="mt-2 text-xs text-muted">No suggestions this time — try again in a moment.</p>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {suggestions.map((s, i) => (
            <div key={i} className="rounded-lg bg-[var(--background)] p-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  {fields.map((f) =>
                    s[f.name] ? (
                      <div key={f.name} className="text-xs leading-relaxed">
                        <span className="font-medium text-[var(--foreground)]">{f.label}: </span>
                        <span className="text-muted">{s[f.name]}</span>
                      </div>
                    ) : null
                  )}
                </div>
                <button
                  type="button"
                  disabled={added.has(i)}
                  onClick={() => {
                    onAdd(s);
                    setAdded((prev) => new Set(prev).add(i));
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--sails-blue)] transition-colors duration-150 hover:bg-[var(--sails-blue-light)] disabled:text-faint"
                >
                  {added.has(i) ? <CheckCircleIcon className="h-3 w-3" /> : <PlusIcon className="h-3 w-3" />}
                  {added.has(i) ? "Added" : "Add"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
