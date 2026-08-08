"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExerciseDef, Step } from "@/lib/content/exercise-schema";
import { renderTemplate } from "@/lib/template";
import { evaluateFormula } from "@/lib/formula";
import { submitExercise, saveProgress } from "./actions";
import { AiSuggestPanel } from "./AiSuggestPanel";
import { AiGenerateField } from "./AiGenerateField";
import { UrlScrapeField } from "./UrlScrapeField";
import { QuizField } from "./QuizField";
import { LightbulbIcon, SparkleIcon, PlusIcon, XIcon, ArrowRightIcon } from "@/components/icons";

type Answers = Record<string, unknown>;

const fieldClass =
  "mt-1 w-full rounded-lg border border-[var(--sails-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition-shadow duration-150 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--sails-blue)]/40 focus:border-[var(--sails-blue)]";
const cardClass = "rounded-xl border border-[var(--sails-border)] bg-[var(--background)] p-4 shadow-[var(--shadow-soft)]";

const ANSWERABLE_TYPES = new Set([
  "input_text",
  "input_list",
  "input_table",
  "select",
  "rank",
  "calculator",
  "ai_generate",
  "url_scrape",
  "quiz",
]);

function Prose({
  body,
  data,
  variant,
}: {
  body: string;
  data: { context: Record<string, unknown>; answers: Record<string, unknown> };
  variant: "teach" | "example";
}) {
  const rendered = renderTemplate(body, data);
  const Icon = variant === "teach" ? LightbulbIcon : SparkleIcon;
  return (
    <div
      className={`flex gap-3 rounded-xl border p-4 ${
        variant === "teach"
          ? "border-[var(--sails-border)] bg-[var(--background)]"
          : "border-[var(--sails-blue-light)] bg-[var(--sails-blue-light)]/50"
      }`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sails-blue)]" />
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{rendered.trim()}</div>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
    >
      <XIcon className="h-3.5 w-3.5" />
    </button>
  );
}

function isEmptyRow(row: Record<string, string>): boolean {
  return Object.keys(row).length === 0 || Object.values(row).every((v) => !v);
}

/** Drops an AI suggestion into the first blank row, or appends if every row is already filled and there's room — so it lands in the exact same editable UI as a manually-typed row. */
function addSuggestionToRows(
  rows: Record<string, string>[],
  item: Record<string, string>,
  max: number
): Record<string, string>[] {
  const emptyIndex = rows.findIndex(isEmptyRow);
  if (emptyIndex >= 0) return rows.map((r, i) => (i === emptyIndex ? item : r));
  if (rows.length < max) return [...rows, item];
  return rows;
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--sails-border)] px-3.5 py-1.5 text-sm font-medium text-[var(--sails-blue)] transition-colors duration-150 hover:bg-[var(--sails-blue-light)]"
    >
      <PlusIcon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function InputTextField({
  step,
  value,
  onChange,
}: {
  step: Extract<Step, { type: "input_text" }>;
  value: string;
  onChange: (v: string) => void;
}) {
  const Tag = step.multiline ? "textarea" : "input";
  return (
    <label className="block">
      <span className="text-sm font-medium text-[var(--foreground)]">{step.label}</span>
      <Tag
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={step.placeholder}
        maxLength={step.max_length}
        rows={step.multiline ? 4 : undefined}
        className={fieldClass}
      />
    </label>
  );
}

function InputListField({
  step,
  exerciseSlug,
  value,
  onChange,
}: {
  step: Extract<Step, { type: "input_list" }>;
  exerciseSlug: string;
  value: Record<string, string>[];
  onChange: (v: Record<string, string>[]) => void;
}) {
  const rows = value.length ? value : Array.from({ length: step.min }, () => ({}) as Record<string, string>);

  function updateRow(i: number, field: string, v: string) {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [field]: v } : r));
    onChange(next);
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium text-[var(--foreground)]">{step.label}</legend>
      {step.suggest && (
        <div className="mt-2">
          <AiSuggestPanel
            exerciseSlug={exerciseSlug}
            stepId={step.id}
            fields={step.fields}
            existingItems={rows}
            onAdd={(item) => onChange(addSuggestionToRows(rows, item, step.max))}
          />
        </div>
      )}
      <div className="mt-2 flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className={cardClass}>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[var(--sails-gray)] px-2 py-0.5 text-xs font-medium text-muted">
                {i + 1} of {step.max}
              </span>
              {rows.length > step.min && <RemoveButton onClick={() => onChange(rows.filter((_, idx) => idx !== i))} />}
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {step.fields.map((field) => (
                <label key={field.name} className="block">
                  <span className="text-xs font-medium text-muted">{field.label}</span>
                  {field.type === "select" ? (
                    <select
                      value={row[field.name] ?? ""}
                      onChange={(e) => updateRow(i, field.name, e.target.value)}
                      className={fieldClass}
                    >
                      <option value="" disabled>
                        Select...
                      </option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={row[field.name] ?? ""}
                      onChange={(e) => updateRow(i, field.name, e.target.value)}
                      rows={2}
                      className={fieldClass}
                    />
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      value={row[field.name] ?? ""}
                      onChange={(e) => updateRow(i, field.name, e.target.value)}
                      className={fieldClass}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {rows.length < step.max && <AddButton onClick={() => onChange([...rows, {}])} label="Add another" />}
    </fieldset>
  );
}

function InputTableField({
  step,
  exerciseSlug,
  value,
  onChange,
}: {
  step: Extract<Step, { type: "input_table" }>;
  exerciseSlug: string;
  value: Record<string, string>[];
  onChange: (v: Record<string, string>[]) => void;
}) {
  if (step.row_mode === "fixed") {
    const rows =
      value.length === step.fixed_rows.length
        ? value
        : step.fixed_rows.map((r) => ({ row_id: r.row_id, ...(value.find((v) => v.row_id === r.row_id) ?? {}) }));

    function updateRow(rowId: string, col: string, v: string) {
      onChange(rows.map((r) => (r.row_id === rowId ? { ...r, [col]: v } : r)));
    }

    return (
      <fieldset>
        <legend className="text-sm font-medium text-[var(--foreground)]">{step.label}</legend>
        <div className="mt-2 flex flex-col gap-3">
          {step.fixed_rows.map((fr) => {
            const row = (rows.find((r) => r.row_id === fr.row_id) ?? { row_id: fr.row_id }) as Record<
              string,
              string
            >;
            return (
              <div key={fr.row_id} className={cardClass}>
                <div className="text-sm font-medium text-[var(--foreground)]">{fr.label}</div>
                {fr.reference_text && <div className="mt-0.5 text-xs text-muted">{fr.reference_text}</div>}
                <div className="mt-2.5 flex flex-col gap-2">
                  {step.columns.map((col) => (
                    <textarea
                      key={col.name}
                      value={row[col.name] ?? ""}
                      onChange={(e) => updateRow(fr.row_id, col.name, e.target.value)}
                      placeholder={col.label}
                      rows={2}
                      className={fieldClass}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>
    );
  }

  // dynamic row_mode — same add/remove shape as InputListField, multi-column.
  const rows = value.length ? value : Array.from({ length: step.min }, () => ({}) as Record<string, string>);
  function updateDynRow(i: number, col: string, v: string) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [col]: v } : r)));
  }
  return (
    <fieldset>
      <legend className="text-sm font-medium text-[var(--foreground)]">{step.label}</legend>
      {step.suggest && (
        <div className="mt-2">
          <AiSuggestPanel
            exerciseSlug={exerciseSlug}
            stepId={step.id}
            fields={step.columns}
            existingItems={rows}
            onAdd={(item) => onChange(addSuggestionToRows(rows, item, step.max))}
          />
        </div>
      )}
      <div className="mt-2 flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className={cardClass}>
            <div className="flex items-center justify-end">
              {rows.length > step.min && <RemoveButton onClick={() => onChange(rows.filter((_, idx) => idx !== i))} />}
            </div>
            <div className="flex flex-col gap-2.5">
              {step.columns.map((col) => (
                <label key={col.name} className="block">
                  <span className="text-xs font-medium text-muted">{col.label}</span>
                  {col.type === "select" ? (
                    <select
                      value={row[col.name] ?? ""}
                      onChange={(e) => updateDynRow(i, col.name, e.target.value)}
                      className={fieldClass}
                    >
                      <option value="" disabled>
                        Select...
                      </option>
                      {col.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : col.type === "textarea" ? (
                    <textarea
                      value={row[col.name] ?? ""}
                      onChange={(e) => updateDynRow(i, col.name, e.target.value)}
                      rows={2}
                      className={fieldClass}
                    />
                  ) : (
                    <input
                      type={col.type === "number" ? "number" : "text"}
                      value={row[col.name] ?? ""}
                      onChange={(e) => updateDynRow(i, col.name, e.target.value)}
                      className={fieldClass}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {rows.length < step.max && <AddButton onClick={() => onChange([...rows, {}])} label="Add row" />}
    </fieldset>
  );
}

function SelectField({
  step,
  value,
  onChange,
}: {
  step: Extract<Step, { type: "select" }>;
  value: string | string[];
  onChange: (v: string | string[]) => void;
}) {
  if (step.multiple) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset>
        <legend className="text-sm font-medium text-[var(--foreground)]">{step.label}</legend>
        <div className="mt-2 flex flex-col gap-1.5">
          {step.options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2.5 rounded-lg border border-[var(--sails-border)] px-3 py-2 text-sm has-checked:border-[var(--sails-blue)] has-checked:bg-[var(--sails-blue-light)]"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, opt.value]
                      : selected.filter((v) => v !== opt.value)
                  )
                }
                className="h-4 w-4 accent-[var(--sails-blue)]"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <label className="block">
      <span className="text-sm font-medium text-[var(--foreground)]">{step.label}</span>
      <select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
        <option value="" disabled>
          Select...
        </option>
        {step.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RankField({
  step,
  context,
  value,
  onChange,
}: {
  step: Extract<Step, { type: "rank" }>;
  context: Record<string, unknown>;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const items = useMemo(() => {
    if (step.source === "fixed") return step.items;
    const raw = context[step.context_key];
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((item, i) => ({
      value: String(i),
      label: typeof item === "object" && item && "title" in item ? String((item as { title: unknown }).title) : JSON.stringify(item),
    }));
  }, [step, context]);

  const order = value.length ? value : items.map((i) => i.value);

  function move(index: number, dir: -1 | 1) {
    const next = [...order];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium text-[var(--foreground)]">{step.label}</legend>
      <ol className="mt-2 flex flex-col gap-1.5">
        {order.map((val, i) => {
          const item = items.find((it) => it.value === val);
          return (
            <li
              key={val}
              className="flex items-center justify-between rounded-lg border border-[var(--sails-border)] bg-[var(--background)] px-3.5 py-2.5 text-sm shadow-[var(--shadow-soft)]"
            >
              <span className="text-[var(--foreground)]">
                <span className="mr-2 text-muted">{i + 1}.</span>
                {item?.label ?? val}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  aria-label="Move up"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-[var(--sails-gray)] hover:text-[var(--sails-blue)]"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  aria-label="Move down"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-[var(--sails-gray)] hover:text-[var(--sails-blue)]"
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
}

function CalculatorField({
  step,
  value,
  onChange,
}: {
  step: Extract<Step, { type: "calculator" }>;
  value: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
}) {
  const inputs = { ...Object.fromEntries(step.inputs.map((i) => [i.name, i.default ?? 0])), ...value };

  let result: number | null = null;
  let error: string | null = null;
  try {
    result = evaluateFormula(step.formula, inputs);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // `result` rides along on the stored answer (not just rendered) so a
  // `writes` mapping can target `answers.<stepId>.result` the same way it
  // targets any other step's field — otherwise the computed number could
  // never leave the page. That only happens on `onChange` below, so an
  // untouched calculator (defaults left as-is) never populates `answers` at
  // all — the page shows a real computed number but submit sends nothing
  // for it. Seed `answers` with the default-computed value once on mount so
  // what's on screen is always what gets saved.
  useEffect(() => {
    if (Object.keys(value).length === 0 && !error) {
      onChange({ ...inputs, result: result ?? 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function updateInput(name: string, raw: string) {
    const newInputs = { ...inputs, [name]: parseFloat(raw) || 0 };
    let newResult = 0;
    try {
      newResult = evaluateFormula(step.formula, newInputs);
    } catch {
      newResult = 0;
    }
    onChange({ ...newInputs, result: newResult });
  }

  return (
    <fieldset className={cardClass}>
      <legend className="text-sm font-medium text-[var(--foreground)]">{step.label}</legend>
      <div className="mt-2 flex flex-col gap-2.5">
        {step.inputs.map((input) => (
          <label key={input.name} className="flex items-center justify-between gap-3 text-sm text-[var(--foreground)]">
            <span>
              {input.label} {input.unit && <span className="text-muted">({input.unit})</span>}
            </span>
            <input
              type="number"
              value={inputs[input.name] ?? ""}
              onChange={(e) => updateInput(input.name, e.target.value)}
              className="w-32 rounded-lg border border-[var(--sails-border)] bg-[var(--background)] px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sails-blue)]/40"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--sails-blue-light)] px-3.5 py-2.5 text-sm">
        <span className="font-medium text-[var(--foreground)]">{step.output.label}</span>
        <span className="text-lg font-semibold text-[var(--sails-blue)]">
          {error ? <span className="text-sm text-red-600">{error}</span> : (result ?? 0).toLocaleString()}
          {step.output.unit && !error ? ` ${step.output.unit}` : ""}
        </span>
      </div>
    </fieldset>
  );
}

export function ExerciseForm({
  exercise,
  sessionId,
  initialAnswers,
  context,
}: {
  exercise: ExerciseDef;
  sessionId: string;
  initialAnswers: Answers;
  context: Record<string, unknown>;
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers ?? {});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function set(stepId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [stepId]: value }));
  }

  // Autosave, debounced — skips the mount-time run so it doesn't re-save
  // initialAnswers straight back to themselves on every page load.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      saveProgress(sessionId, answers);
    }, 800);
    return () => clearTimeout(timeout);
  }, [answers, sessionId]);

  function handleSubmit() {
    startTransition(async () => {
      await submitExercise(sessionId, exercise.slug, answers);
      router.push("/journey");
      router.refresh();
    });
  }

  const templateData = { context, answers };

  const answerableSteps = exercise.steps.filter((s) => ANSWERABLE_TYPES.has(s.type) && "id" in s);
  const answeredCount = answerableSteps.filter((s) => {
    const v = answers[(s as { id: string }).id];
    return Array.isArray(v) ? v.length > 0 : v != null && v !== "";
  }).length;
  const progressPct = answerableSteps.length ? Math.round((answeredCount / answerableSteps.length) * 100) : 0;

  return (
    <div className="mt-6 flex flex-col gap-5">
      {answerableSteps.length > 1 && (
        <div className="sticky top-16 z-10 rounded-full border border-[var(--sails-border)] bg-[var(--background)]/90 px-4 py-2 text-xs text-muted shadow-[var(--shadow-soft)] backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span>
              {answeredCount} of {answerableSteps.length} answered
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--sails-gray)]">
            <div
              className="h-full rounded-full bg-[var(--sails-blue)] transition-all duration-300 ease-[var(--ease-out)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {exercise.steps.map((step, i) => {
        const key = `${step.type}-${i}`;
        switch (step.type) {
          case "teach":
          case "example":
            return <Prose key={key} body={step.body} data={templateData} variant={step.type} />;
          case "input_text":
            return (
              <InputTextField
                key={key}
                step={step}
                value={(answers[step.id] as string) ?? ""}
                onChange={(v) => set(step.id, v)}
              />
            );
          case "input_list":
            return (
              <InputListField
                key={key}
                step={step}
                exerciseSlug={exercise.slug}
                value={(answers[step.id] as Record<string, string>[]) ?? []}
                onChange={(v) => set(step.id, v)}
              />
            );
          case "input_table":
            return (
              <InputTableField
                key={key}
                step={step}
                exerciseSlug={exercise.slug}
                value={(answers[step.id] as Record<string, string>[]) ?? []}
                onChange={(v) => set(step.id, v)}
              />
            );
          case "select":
            return (
              <SelectField
                key={key}
                step={step}
                value={(answers[step.id] as string | string[]) ?? (step.multiple ? [] : "")}
                onChange={(v) => set(step.id, v)}
              />
            );
          case "rank":
            return (
              <RankField
                key={key}
                step={step}
                context={context}
                value={(answers[step.id] as string[]) ?? []}
                onChange={(v) => set(step.id, v)}
              />
            );
          case "calculator":
            return (
              <CalculatorField
                key={key}
                step={step}
                value={(answers[step.id] as Record<string, number>) ?? {}}
                onChange={(v) => set(step.id, v)}
              />
            );
          case "ai_generate": {
            const fields = step.fields ?? [{ name: "content", label: "Content", type: "textarea" as const }];
            return (
              <AiGenerateField
                key={key}
                exerciseSlug={exercise.slug}
                stepId={step.id}
                label={fields.length === 1 && fields[0].name === "content" ? "Generated content" : "Diagnosis"}
                fields={fields}
                value={(answers[step.id] as Record<string, string>) ?? {}}
                onChange={(v) => set(step.id, v)}
              />
            );
          }
          case "url_scrape":
            return (
              <UrlScrapeField
                key={key}
                exerciseSlug={exercise.slug}
                stepId={step.id}
                label={step.label}
                fields={step.fields}
                value={(answers[step.id] as Record<string, string>) ?? {}}
                onChange={(v) => set(step.id, v)}
              />
            );
          case "quiz":
            return (
              <QuizField
                key={key}
                step={step}
                data={templateData}
                value={(answers[step.id] as string) ?? ""}
                onChange={(v) => set(step.id, v)}
              />
            );
          case "ai_review":
            return (
              <div
                key={key}
                className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--sails-border)] p-4 text-sm text-muted"
              >
                <SparkleIcon className="h-4 w-4 shrink-0" />
                AI-assisted step — available in Phase 2.
              </div>
            );
          case "output_preview":
            return (
              <div key={key} className="rounded-xl bg-[var(--sails-blue-light)] p-4 text-sm">
                <span className="font-medium text-[var(--foreground)]">This will update: </span>
                <span className="text-muted">{exercise.writes.map((w) => w.to).join(", ") || "nothing yet"}</span>
              </div>
            );
          default:
            return null;
        }
      })}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="group inline-flex w-fit items-center gap-2 rounded-full bg-[var(--sails-blue)] px-6 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-all duration-200 ease-[var(--ease-out)] hover:bg-[var(--sails-navy)] hover:shadow-[var(--shadow-soft-hover)] disabled:opacity-50"
      >
        {isPending ? (
          "Saving..."
        ) : (
          <>
            Complete exercise
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </div>
  );
}
