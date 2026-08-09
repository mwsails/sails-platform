"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scrapeBusiness, saveBusiness, saveRole, saveExperience } from "./actions";
import { CheckCircleIcon, CircleIcon, SparkleIcon, ArrowRightIcon } from "@/components/icons";

type Step = "business" | "role" | "experience";

type BusinessFields = {
  domain: string;
  name: string;
  what_you_sell: string;
  category: string;
  capabilities: string;
  proof: string;
  stage: string;
};

const BUSINESS_FIELD_LABELS: { name: keyof BusinessFields; label: string }[] = [
  { name: "name", label: "Company name" },
  { name: "what_you_sell", label: "What you sell" },
  { name: "category", label: "Category" },
  { name: "capabilities", label: "Key capabilities" },
  { name: "proof", label: "Proof points" },
  { name: "stage", label: "Company stage" },
];

const STEPS: { id: Step; label: string; eyebrow: string }[] = [
  { id: "business", label: "Your business", eyebrow: "Business" },
  { id: "role", label: "Your role", eyebrow: "You" },
  { id: "experience", label: "Your experience", eyebrow: "You" },
];

const fieldClass =
  "mt-1 w-full rounded-lg border border-[var(--sails-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition-shadow duration-150 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--sails-blue)]/40 focus:border-[var(--sails-blue)]";

export function OnboardingFlow({
  initialStep,
  businessDone,
  roleDone,
  experienceDone,
  initialBusiness,
}: {
  initialStep: Step;
  businessDone: boolean;
  roleDone: boolean;
  experienceDone: boolean;
  initialBusiness: BusinessFields;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [done, setDone] = useState({ business: businessDone, role: roleDone, experience: experienceDone });
  const router = useRouter();

  function advance(from: Step, to: Step | "finish") {
    setDone((prev) => ({ ...prev, [from]: true }));
    if (to === "finish") {
      router.push("/journey");
      router.refresh();
    } else {
      setStep(to);
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl gap-10 px-6 py-12">
      <aside className="w-44 shrink-0">
        <div className="mb-6 font-[family-name:var(--font-serif)] text-lg font-semibold text-[var(--foreground)]">
          SAILS
        </div>
        <ol className="flex flex-col gap-1">
          {STEPS.map((s) => {
            const isDone = done[s.id];
            const isCurrent = s.id === step;
            return (
              <li key={s.id}>
                <div
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${
                    isCurrent
                      ? "bg-[var(--sails-blue-light)] font-medium text-[var(--sails-blue)]"
                      : isDone
                        ? "text-[var(--foreground)]"
                        : "text-faint"
                  }`}
                >
                  {isDone ? (
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-[var(--success)]" />
                  ) : (
                    <CircleIcon className="h-4 w-4 shrink-0" />
                  )}
                  {s.label}
                </div>
              </li>
            );
          })}
        </ol>
      </aside>

      <div className="min-w-0 flex-1">
        {step === "business" && (
          <BusinessStep initial={initialBusiness} onDone={() => advance("business", "role")} />
        )}
        {step === "role" && <RoleStep onDone={() => advance("role", "experience")} />}
        {step === "experience" && <ExperienceStep onDone={() => advance("experience", "finish")} />}
      </div>
    </main>
  );
}

function BusinessStep({ initial, onDone }: { initial: BusinessFields; onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [fields, setFields] = useState<BusinessFields>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [manual, setManual] = useState(false);
  const hasDraft = initial.name !== "" || fields.name !== "" || manual;

  function read() {
    setError(null);
    startTransition(async () => {
      const result = await scrapeBusiness(url);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setFields(result.content as BusinessFields);
    });
  }

  function updateField(name: keyof BusinessFields, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  function confirm() {
    startTransition(async () => {
      const trimmed = Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, v.trim()])
      ) as unknown as BusinessFields;
      await saveBusiness(trimmed);
      onDone();
    });
  }

  return (
    <div>
      <span className="text-xs font-semibold tracking-[0.14em] text-[var(--sails-blue)] uppercase">
        Onboarding · Business
      </span>
      <h1 className="mt-1 font-[family-name:var(--font-serif)] text-2xl font-semibold text-[var(--foreground)]">
        Your business
      </h1>
      <p className="mt-2 text-sm text-muted">
        Give us the site and we read it — what you sell, your capabilities, your proof points. You correct what we
        got wrong on this same screen. Nothing after this starts blank.
      </p>

      {!hasDraft && (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--sails-blue)]/30 bg-[var(--sails-blue-light)]/20 p-4">
          <label className="block text-xs font-medium text-muted">Company website</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="yourcompany.com"
              className={fieldClass}
            />
            <button
              type="button"
              onClick={read}
              disabled={isPending}
              className="shrink-0 rounded-full bg-[var(--sails-blue)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--sails-navy)] disabled:opacity-50"
            >
              {isPending ? "Reading your site..." : "Read my site"}
            </button>
          </div>
          {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
          <button
            type="button"
            onClick={() => setManual(true)}
            className="mt-2 text-xs text-muted underline decoration-dotted hover:text-[var(--foreground)]"
          >
            Skip, I&apos;ll fill this in myself
          </button>
        </div>
      )}

      {hasDraft && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[var(--sails-border)] bg-[var(--background)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <SparkleIcon className="h-3.5 w-3.5 text-[var(--sails-blue)]" />
              From the scrape — edit anything before you continue
            </span>
            {url && (
              <button
                type="button"
                onClick={read}
                disabled={isPending}
                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--sails-blue)] transition-colors duration-150 hover:bg-[var(--sails-blue-light)] disabled:opacity-50"
              >
                {isPending ? "Reading..." : "Re-read site"}
              </button>
            )}
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          {BUSINESS_FIELD_LABELS.map((f) => (
            <label key={f.name} className="block">
              <span className="text-xs font-medium text-muted">{f.label}</span>
              <textarea
                value={fields[f.name]}
                onChange={(e) => updateField(f.name, e.target.value)}
                rows={f.name === "name" || f.name === "category" ? 1 : 2}
                className={fieldClass}
              />
            </label>
          ))}
          <button
            type="button"
            onClick={confirm}
            disabled={isPending || fields.name.trim() === ""}
            className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-[var(--sails-blue)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--sails-navy)] disabled:opacity-50"
          >
            Looks right — continue <ArrowRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function RoleStep({ onDone }: { onDone: () => void }) {
  const [role, setRole] = useState("");
  const [isPending, startTransition] = useTransition();

  function confirm() {
    if (!role) return;
    startTransition(async () => {
      await saveRole(role);
      onDone();
    });
  }

  const options = [
    { value: "founder", label: "Founder" },
    { value: "sales_leader", label: "Sales leader / manager" },
    { value: "rep", label: "Individual rep" },
    { value: "other", label: "Other" },
  ];

  return (
    <div>
      <span className="text-xs font-semibold tracking-[0.14em] text-[var(--sails-blue)] uppercase">
        Onboarding · You
      </span>
      <h1 className="mt-1 font-[family-name:var(--font-serif)] text-2xl font-semibold text-[var(--foreground)]">
        Your role
      </h1>
      <p className="mt-2 text-sm text-muted">
        Colors every screen after this one — a sales leader and an individual rep see different depth.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm transition-colors duration-150 ${
              role === opt.value
                ? "border-[var(--sails-blue)] bg-[var(--sails-blue-light)]"
                : "border-[var(--sails-border)] hover:border-[var(--sails-blue)]/40"
            }`}
          >
            <input
              type="radio"
              name="role"
              value={opt.value}
              checked={role === opt.value}
              onChange={() => setRole(opt.value)}
              className="accent-[var(--sails-blue)]"
            />
            {opt.label}
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={confirm}
        disabled={isPending || !role}
        className="mt-5 flex items-center gap-1.5 rounded-full bg-[var(--sails-blue)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--sails-navy)] disabled:opacity-50"
      >
        Continue <ArrowRightIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ExperienceStep({ onDone }: { onDone: () => void }) {
  const [experience, setExperience] = useState("");
  const [isPending, startTransition] = useTransition();

  function confirm() {
    if (!experience) return;
    startTransition(async () => {
      await saveExperience(experience);
      onDone();
    });
  }

  const options = [
    { value: "none", label: "None — this is new to me" },
    { value: "some", label: "Some — I've sold before, informally or early-career" },
    { value: "extensive", label: "Extensive — years of quota-carrying or sales-leadership experience" },
  ];

  return (
    <div>
      <span className="text-xs font-semibold tracking-[0.14em] text-[var(--sails-blue)] uppercase">
        Onboarding · You
      </span>
      <h1 className="mt-1 font-[family-name:var(--font-serif)] text-2xl font-semibold text-[var(--foreground)]">
        Your sales experience
      </h1>
      <p className="mt-2 text-sm text-muted">
        Self-assessed. Calibrates how much teaching you need before Practice, not a test.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm transition-colors duration-150 ${
              experience === opt.value
                ? "border-[var(--sails-blue)] bg-[var(--sails-blue-light)]"
                : "border-[var(--sails-border)] hover:border-[var(--sails-blue)]/40"
            }`}
          >
            <input
              type="radio"
              name="experience"
              value={opt.value}
              checked={experience === opt.value}
              onChange={() => setExperience(opt.value)}
              className="accent-[var(--sails-blue)]"
            />
            {opt.label}
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={confirm}
        disabled={isPending || !experience}
        className="mt-5 flex items-center gap-1.5 rounded-full bg-[var(--sails-blue)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--sails-navy)] disabled:opacity-50"
      >
        Continue to your diagnostic <ArrowRightIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
