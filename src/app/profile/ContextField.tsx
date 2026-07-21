"use client";

import { useState, useTransition } from "react";
import { updateContextField } from "./actions";

export function ContextField({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-neutral-400">{fieldKey}</div>
          <div className="truncate text-sm text-[var(--sails-navy)]">
            {typeof value === "string" ? value : JSON.stringify(value)}
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-xs text-[var(--sails-blue)] hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-neutral-100 py-2">
      <div className="text-xs font-medium text-neutral-400">{fieldKey}</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(10, text.split("\n").length + 1)}
        className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 font-mono text-xs"
      />
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      <div className="mt-1 flex gap-2">
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
          className="rounded-full bg-[var(--sails-blue)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--sails-navy)] disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => {
            setText(JSON.stringify(value, null, 2));
            setEditing(false);
            setError(null);
          }}
          className="rounded-full px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
