"use client";

import type { Step } from "@/lib/content/exercise-schema";
import { renderTemplate } from "@/lib/template";
import { CheckCircleIcon, XIcon } from "@/components/icons";

/**
 * Renders a `quiz` step: an optional interpolated scenario, radio-style
 * options, and immediate correct/incorrect feedback the moment an option is
 * picked — pure client-side comparison against the (possibly interpolated)
 * `correct` value, no server round-trip. This is the Know (and, chained
 * after an ai_generate step, Awareness) mechanic in the IKAP teaching loop.
 */
export function QuizField({
  step,
  data,
  value,
  onChange,
}: {
  step: Extract<Step, { type: "quiz" }>;
  data: { context: Record<string, unknown>; answers: Record<string, unknown> };
  value: string;
  onChange: (v: string) => void;
}) {
  const scenario = step.scenario ? renderTemplate(step.scenario, data).trim() : null;
  const correct = renderTemplate(step.correct, data).trim();
  const explanation = renderTemplate(step.explanation, data).trim();
  const answered = value !== "" && value != null;
  const isCorrect = answered && value === correct;

  return (
    <fieldset className="flex flex-col gap-2.5">
      {scenario && (
        <div className="rounded-xl border border-[var(--sails-blue-light)] bg-[var(--sails-blue-light)]/50 p-4 text-sm leading-relaxed text-muted">
          {scenario}
        </div>
      )}
      <legend className="text-sm font-medium text-[var(--foreground)]">{step.label}</legend>
      <div className="flex flex-col gap-1.5">
        {step.options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--sails-border)] px-3 py-2 text-sm has-checked:border-[var(--sails-blue)] has-checked:bg-[var(--sails-blue-light)]"
          >
            <input
              type="radio"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 accent-[var(--sails-blue)]"
            />
            {opt.label}
          </label>
        ))}
      </div>
      {answered && (
        <div
          className={`flex gap-2.5 rounded-xl border p-3.5 text-sm leading-relaxed ${
            isCorrect
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {isCorrect ? (
            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XIcon className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            <div className="font-medium">{isCorrect ? "Correct" : "Not quite"}</div>
            <div className="mt-0.5">{explanation}</div>
          </div>
        </div>
      )}
    </fieldset>
  );
}
