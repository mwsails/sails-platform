"use client";

import { useState, useTransition } from "react";
import { updateContextField } from "./actions";
import { CheckCircleIcon, XIcon } from "@/components/icons";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-[var(--sails-border)] bg-[var(--background)] px-2.5 py-2 font-mono text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sails-blue)]/40 focus:border-[var(--sails-blue)]";

export function ContextField({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="group flex items-start justify-between gap-4 border-b border-[var(--sails-border)] py-2.5 last:border-b-0">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-muted">{fieldKey}</div>
          <div className="mt-0.5 truncate text-sm text-[var(--foreground)]">
            {typeof value === "string" ? value : JSON.stringify(value)}
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--sails-blue)] opacity-0 transition-opacity duration-150 hover:bg-[var(--sails-blue-light)] group-hover:opacity-100"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--sails-blue)]/30 bg-[var(--sails-blue-light)]/30 p-3">
      <div className="font-mono text-xs text-muted">{fieldKey}</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(10, text.split("\n").length + 1)}
        className={fieldClass}
      />
      {error && <div className="mt-1.5 text-xs text-red-600">{error}</div>}
      <div className="mt-2 flex gap-2">
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              try {
                await updateContextField(fieldKey, text);
                setEditing(false);
                setError(null);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            })
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sails-blue)] px-3 py-1 text-xs font-medium text-white transition-colors duration-150 hover:bg-[var(--sails-navy)] disabled:opacity-50"
        >
          <CheckCircleIcon className="h-3.5 w-3.5" />
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => {
            setText(JSON.stringify(value, null, 2));
            setEditing(false);
            setError(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted transition-colors duration-150 hover:bg-[var(--sails-gray)]"
        >
          <XIcon className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
