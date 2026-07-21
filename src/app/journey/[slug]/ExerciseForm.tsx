"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExerciseDef, Step } from "@/lib/content/exercise-schema";
import { renderTemplate } from "@/lib/template";
import { evaluateFormula } from "@/lib/formula";
import { submitExercise } from "./actions";

type Answers = Record<string, unknown>;

function Prose({ body, data }: { body: string; data: Record<string, unknown> }) {
  const rendered = renderTemplate(body, data);
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{rendered.trim()}</div>
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
      <span className="text-sm font-medium text-[var(--sails-navy)]">{step.label}</span>
      <Tag
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={step.placeholder}
        maxLength={step.max_length}
        rows={step.multiline ? 4 : undefined}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function InputListField({
  step,
  value,
  onChange,
}: {
  step: Extract<Step, { type: "input_list" }>;
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
      <legend className="text-sm font-medium text-[var(--sails-navy)]">{step.label}</legend>
      <div className="mt-2 flex flex-col gap-4">
        {rows.map((row, i) => (
          <div key={i} className="rounded-md border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">
                {i + 1} of {step.max}
              </span>
              {rows.length > step.min && (
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                  className="text-xs text-neutral-400 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {step.fields.map((field) => (
                <label key={field.name} className="block">
                  <span className="text-xs text-neutral-500">{field.label}</span>
                  {field.type === "select" ? (
                    <select
                      value={row[field.name] ?? ""}
                      onChange={(e) => updateRow(i, field.name, e.target.value)}
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
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
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      value={row[field.name] ?? ""}
                      onChange={(e) => updateRow(i, field.name, e.target.value)}
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {rows.length < step.max && (
        <button
          type="button"
          onClick={() => onChange([...rows, {}])}
          className="mt-2 text-sm text-[var(--sails-blue)] hover:underline"
        >
          + Add another
        </button>
      )}
    </fieldset>
  );
}

function InputTableField({
  step,
  value,
  onChange,
}: {
  step: Extract<Step, { type: "input_table" }>;
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
        <legend className="text-sm font-medium text-[var(--sails-navy)]">{step.label}</legend>
        <div className="mt-2 flex flex-col gap-3">
          {step.fixed_rows.map((fr) => {
            const row = (rows.find((r) => r.row_id === fr.row_id) ?? { row_id: fr.row_id }) as Record<
              string,
              string
            >;
            return (
              <div key={fr.row_id} className="rounded-md border border-neutral-200 p-3">
                <div className="text-sm font-medium">{fr.label}</div>
                {fr.reference_text && (
                  <div className="text-xs text-neutral-400">{fr.reference_text}</div>
                )}
                <div className="mt-2 flex flex-col gap-2">
                  {step.columns.map((col) => (
                    <textarea
                      key={col.name}
                      value={row[col.name] ?? ""}
                      onChange={(e) => updateRow(fr.row_id, col.name, e.target.value)}
                      placeholder={col.label}
                      rows={2}
                      className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
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
      <legend className="text-sm font-medium text-[var(--sails-navy)]">{step.label}</legend>
      <div className="mt-2 flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-md border border-neutral-200 p-3">
            {rows.length > step.min && (
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                className="float-right text-xs text-neutral-400 hover:text-red-600"
              >
                Remove
              </button>
            )}
            <div className="flex flex-col gap-2">
              {step.columns.map((col) => (
                <input
                  key={col.name}
                  value={row[col.name] ?? ""}
                  onChange={(e) => updateDynRow(i, col.name, e.target.value)}
                  placeholder={col.label}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {rows.length < step.max && (
        <button
          type="button"
          onClick={() => onChange([...rows, {}])}
          className="mt-2 text-sm text-[var(--sails-blue)] hover:underline"
        >
          + Add row
        </button>
      )}
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
        <legend className="text-sm font-medium text-[var(--sails-navy)]">{step.label}</legend>
        <div className="mt-2 flex flex-col gap-1">
          {step.options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
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
      <span className="text-sm font-medium text-[var(--sails-navy)]">{step.label}</span>
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      >
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
      <legend className="text-sm font-medium text-[var(--sails-navy)]">{step.label}</legend>
      <ol className="mt-2 flex flex-col gap-1">
        {order.map((val, i) => {
          const item = items.find((it) => it.value === val);
          return (
            <li
              key={val}
              className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm"
            >
              <span>
                {i + 1}. {item?.label ?? val}
              </span>
              <span className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} className="text-neutral-400 hover:text-[var(--sails-blue)]">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} className="text-neutral-400 hover:text-[var(--sails-blue)]">
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

  return (
    <fieldset>
      <legend className="text-sm font-medium text-[var(--sails-navy)]">{step.label}</legend>
      <div className="mt-2 flex flex-col gap-2">
        {step.inputs.map((input) => (
          <label key={input.name} className="flex items-center justify-between gap-3 text-sm">
            <span>
              {input.label} {input.unit && <span className="text-neutral-400">({input.unit})</span>}
            </span>
            <input
              type="number"
              value={inputs[input.name] ?? ""}
              onChange={(e) => onChange({ ...inputs, [input.name]: parseFloat(e.target.value) || 0 })}
              className="w-32 rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 rounded-md bg-[var(--sails-gray)] p-3 text-sm">
        <span className="font-medium">{step.output.label}: </span>
        {error ? <span className="text-red-600">{error}</span> : (result ?? 0).toLocaleString()}
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

  function handleSubmit() {
    startTransition(async () => {
      await submitExercise(sessionId, exercise.slug, answers);
      router.push("/journey");
      router.refresh();
    });
  }

  const templateData = { context, answers };

  return (
    <div className="mt-6 flex flex-col gap-6">
      {exercise.steps.map((step, i) => {
        const key = `${step.type}-${i}`;
        switch (step.type) {
          case "teach":
          case "example":
            return <Prose key={key} body={step.body} data={templateData} />;
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
                value={(answers[step.id] as Record<string, string>[]) ?? []}
                onChange={(v) => set(step.id, v)}
              />
            );
          case "input_table":
            return (
              <InputTableField
                key={key}
                step={step}
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
          case "ai_review":
          case "ai_generate":
            return (
              <div key={key} className="rounded-md border border-dashed border-neutral-300 p-3 text-sm text-neutral-400">
                AI-assisted step — available in Phase 2.
              </div>
            );
          case "output_preview":
            return (
              <div key={key} className="rounded-md bg-[var(--sails-gray)] p-3 text-sm">
                <span className="font-medium text-[var(--sails-navy)]">This will update: </span>
                {exercise.writes.map((w) => w.to).join(", ") || "nothing yet"}
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
        className="self-start rounded-full bg-[var(--sails-blue)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--sails-navy)] disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Complete exercise"}
      </button>
    </div>
  );
}
