"use client";

import { useState, useTransition } from "react";
import { SparkleIcon } from "@/components/icons";
import { reviewForStep } from "./actions";

/** True once the reviewed step has something worth critiquing — an array with rows, a non-empty string, or an object with at least one filled key. Matches ANSWERABLE_TYPES' "answered" check in ExerciseForm. */
function hasContent(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (v != null && typeof v === "object") return Object.values(v).some((x) => x != null && x !== "");
  return v != null && v !== "";
}

/**
 * Renders an `ai_review` step: a non-blocking, on-demand critique of the
 * step it reviews. Never writes anywhere — Exercise Schema §9: ai_review
 * "never writes to context itself" — so this has no onChange, just a
 * trigger and a read-only critique once one comes back.
 */
export function AiReviewPanel({
  exerciseSlug,
  reviewsStepId,
  currentAnswer,
}: {
  exerciseSlug: string;
  reviewsStepId: string;
  currentAnswer: unknown;
}) {
  const [critique, setCritique] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ready = hasContent(currentAnswer);

  function review() {
    setError(null);
    startTransition(async () => {
      const result = await reviewForStep(exerciseSlug, reviewsStepId, currentAnswer);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setCritique(result.critique);
    });
  }

  return (
    <div className="rounded-xl border border-dashed border-[var(--sails-blue)]/30 bg-[var(--sails-blue-light)]/20 p-3.5">
      {!critique && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted">
            <SparkleIcon className="h-4 w-4 shrink-0 text-[var(--sails-blue)]" />
            {ready ? "Get a second pair of eyes on what you just wrote." : "Fill in the step above first."}
          </div>
          <button
            type="button"
            onClick={review}
            disabled={isPending || !ready}
            className="shrink-0 rounded-full bg-[var(--sails-blue)] px-3 py-1 text-xs font-medium text-white transition-colors duration-150 hover:bg-[var(--sails-navy)] disabled:opacity-50"
          >
            {isPending ? "Reviewing..." : "Get feedback"}
          </button>
        </div>
      )}
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      {critique && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <SparkleIcon className="h-3.5 w-3.5 text-[var(--sails-blue)]" />
              Feedback on what you wrote above
            </span>
            <button
              type="button"
              onClick={review}
              disabled={isPending || !ready}
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--sails-blue)] transition-colors duration-150 hover:bg-[var(--sails-blue-light)] disabled:opacity-50"
            >
              {isPending ? "Reviewing..." : "Re-check"}
            </button>
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">{critique}</div>
        </div>
      )}
    </div>
  );
}
