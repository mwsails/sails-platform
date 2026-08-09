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

const STEPS: { id: Step; label: string }[] = [
  { id: "business", label: "Your business" },
  { id: "role", label: "Your role" },
  { id: "experience", label: "Your experience" },
];

const fieldClass =
  "mt-1 w-full rounded-lg border border-[var(--sails-border)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--foreground)] transition-shadow duration-150 placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-[var(--sails-blue)]/40 focus:border-[var(--sails-blue)]";

const eyebrowClass = "text-xs font-semibold tracking-[0.14em] text-[var(--sails-blue)] uppercase";
const headlineClass =
  "mt-2 font-[family-name:var(--font-serif)] text-3xl font-semibold text-[var(--foreground)] sm:text-4xl";
const pillClass =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--sails-blue-light)] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[var(--sails-blue)] uppercase";
const primaryButtonClass =
  "mt-2 flex w-fit items-center gap-1.5 rounded-full bg-[var(--sails-blue)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors duration-150 hover:bg-[var(--sails-navy)] disabled:opacity-50";

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

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside
        className="flex shrink-0 flex-col justify-between px-8 py-10 text-white md:w-72"
        style={{ background: "linear-gradient(160deg, var(--sails-navy) 0%, var(--sails-navy-light) 100%)" }}
      >
        <div>
          <div className="font-[family-name:var(--font-serif)] text-xl font-semibold tracking-tight">SAILS</div>
          <p className="mt-1 text-xs text-white/50">Onboarding</p>

          <ol className="mt-10 flex flex-col gap-1">
            {STEPS.map((s) => {
              const isDone = done[s.id];
              const isCurrent = s.id === step;
              return (
                <li key={s.id}>
                  <div
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${
                      isCurrent ? "bg-white/12 font-medium text-white" : isDone ? "text-white/85" : "text-white/35"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircleIcon className="h-4 w-4 shrink-0 text-white" />
                    ) : (
                      <CircleIcon className="h-4 w-4 shrink-0" />
                    )}
                    {s.label}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="text-xs text-white/40">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
      </aside>

      <main className="flex-1 bg-[var(--background-tint)] px-6 py-14 sm:px-14">
        <div className="mx-auto max-w-xl">
          {step === "business" && (
            <BusinessStep initial={initialBusiness} onDone={() => advance("business", "role")} />
          )}
          {step === "role" && <RoleStep onDone={() => advance("role", "experience")} />}
          {step === "experience" && <ExperienceStep onDone={() => advance("experience", "finish")} />}
        </div>
      </main>
    </div>
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
      <span className={eyebrowClass}>Onboarding · Business</span>
      <h1 className={headlineClass}>Your business</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Give us the site and we read it — what you sell, your capabilities, your proof points. You correct what we
        got wrong on this same screen. Nothing after this starts blank.
      </p>

      {!hasDraft && (
        <div className="mt-7 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-5 shadow-[var(--shadow-soft)]">
          <label className="block text-xs font-medium text-muted">Company website</label>
          <div className="mt-1.5 flex items-center gap-2">
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
              className="shrink-0 rounded-full bg-[var(--sails-blue)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors duration-150 hover:bg-[var(--sails-navy)] disabled:opacity-50"
            >
              {isPending ? "Reading your site…" : "Read my site"}
            </button>
          </div>
          {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
          <button
            type="button"
            onClick={() => setManual(true)}
            className="mt-3 text-xs text-muted underline decoration-dotted hover:text-[var(--foreground)]"
          >
            Skip, I&apos;ll fill this in myself
          </button>
        </div>
      )}

      {hasDraft && (
        <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--sails-border)] pb-4">
            <span className={pillClass}>
              <SparkleIcon className="h-3 w-3" />
              From the scrape
            </span>
            {url && (
              <button
                type="button"
                onClick={read}
                disabled={isPending}
                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--sails-blue)] transition-colors duration-150 hover:bg-[var(--sails-blue-light)] disabled:opacity-50"
              >
                {isPending ? "Reading…" : "Re-read site"}
              </button>
            )}
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <div className="flex flex-col gap-3.5">
            {BUSINESS_FIELD_LABELS.map((f) => (
              <label key={f.name} className="block">
                <span className="text-xs font-medium text-muted">{f.label}</span>
                <textarea
                  value={fields[f.name]}
                  onChange={(e) => updateField(f.name, e.target.value)}
                  rows={f.name === "name" || f.name === "category" ? 1 : 3}
                  className={fieldClass}
                />
              </label>
            ))}
          </div>
          <button type="button" onClick={confirm} disabled={isPending || fields.name.trim() === ""} className={primaryButtonClass}>
            Looks right — continue <ArrowRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function OptionList({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="mt-7 flex flex-col gap-2.5">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-center gap-3 rounded-xl border bg-[var(--background)] px-4 py-3 text-sm shadow-[var(--shadow-soft)] transition-colors duration-150 ${
            value === opt.value
              ? "border-[var(--sails-blue)] bg-[var(--sails-blue-light)]"
              : "border-[var(--sails-border)] hover:border-[var(--sails-blue)]/40"
          }`}
        >
          <input
            type="radio"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="accent-[var(--sails-blue)]"
          />
          {opt.label}
        </label>
      ))}
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

  return (
    <div>
      <span className={eyebrowClass}>Onboarding · You</span>
      <h1 className={headlineClass}>Your role</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Colors every screen after this one — a sales leader and an individual rep see different depth.
      </p>
      <OptionList
        value={role}
        onChange={setRole}
        options={[
          { value: "founder", label: "Founder" },
          { value: "sales_leader", label: "Sales leader / manager" },
          { value: "rep", label: "Individual rep" },
          { value: "other", label: "Other" },
        ]}
      />
      <button type="button" onClick={confirm} disabled={isPending || !role} className={primaryButtonClass}>
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

  return (
    <div>
      <span className={eyebrowClass}>Onboarding · You</span>
      <h1 className={headlineClass}>Your sales experience</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Self-assessed. Calibrates how much teaching you need before Practice, not a test.
      </p>
      <OptionList
        value={experience}
        onChange={setExperience}
        options={[
          { value: "none", label: "None — this is new to me" },
          { value: "some", label: "Some — I've sold before, informally or early-career" },
          { value: "extensive", label: "Extensive — years of quota-carrying or sales-leadership experience" },
        ]}
      />
      <button type="button" onClick={confirm} disabled={isPending || !experience} className={primaryButtonClass}>
        Continue to your diagnostic <ArrowRightIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
