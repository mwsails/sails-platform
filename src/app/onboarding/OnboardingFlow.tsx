"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  scrapeBusiness,
  saveBusiness,
  saveRole,
  saveExperience,
  saveHasExistingMotion,
  saveLeadSources,
  deferLeadSources,
} from "./actions";
import { computeSourceMetrics, computeBlended, LEAD_SOURCES, type SourceInput } from "@/lib/onboarding/metrics";
import { CheckCircleIcon, CircleIcon, SparkleIcon, ArrowRightIcon, PlusIcon, XIcon } from "@/components/icons";

type Step = "business" | "role" | "experience" | "motion" | "metrics";

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

const ALL_STEPS: { id: Step; label: string; bucket: string }[] = [
  { id: "business", label: "Your business", bucket: "Business" },
  { id: "role", label: "Your role", bucket: "You" },
  { id: "experience", label: "Your experience", bucket: "You" },
  { id: "motion", label: "Existing motion?", bucket: "Sales motion" },
  { id: "metrics", label: "Metrics by source", bucket: "Sales motion" },
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
  motionDone,
  metricsDone,
  hasExistingMotion,
  initialBusiness,
}: {
  initialStep: Step;
  businessDone: boolean;
  roleDone: boolean;
  experienceDone: boolean;
  motionDone: boolean;
  metricsDone: boolean;
  hasExistingMotion: "yes" | "no" | null;
  initialBusiness: BusinessFields;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [done, setDone] = useState({
    business: businessDone,
    role: roleDone,
    experience: experienceDone,
    motion: motionDone,
    metrics: metricsDone,
  });
  const [motionAnswer, setMotionAnswer] = useState<"yes" | "no" | null>(hasExistingMotion);
  const router = useRouter();

  function finish() {
    router.push("/journey");
    router.refresh();
  }

  function advanceFromMotion(answer: "yes" | "no") {
    setMotionAnswer(answer);
    setDone((prev) => ({ ...prev, motion: true }));
    if (answer === "no") {
      finish();
    } else {
      setStep("metrics");
    }
  }

  // "No" removes Metrics from the visible flow entirely — a target the
  // user invented can't diagnose itself, so there's nothing to show.
  const visibleSteps = ALL_STEPS.filter((s) => s.id !== "metrics" || motionAnswer !== "no");
  const stepIndex = visibleSteps.findIndex((s) => s.id === step);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside
        className="flex shrink-0 flex-col justify-between px-8 py-10 text-white md:w-72"
        style={{ background: "linear-gradient(160deg, var(--sails-navy) 0%, var(--sails-navy-light) 100%)" }}
      >
        <div>
          <div className="font-[family-name:var(--font-serif)] text-xl font-semibold tracking-tight">SAILS</div>
          <p className="mt-1 text-xs text-white/50">Onboarding</p>

          <div className="mt-10 flex flex-col gap-4">
            {Object.entries(
              visibleSteps.reduce<Record<string, typeof visibleSteps>>((acc, s) => {
                (acc[s.bucket] ??= []).push(s);
                return acc;
              }, {})
            ).map(([bucket, items]) => (
              <div key={bucket}>
                <p className="px-3 text-[10px] font-semibold tracking-[0.14em] text-white/35 uppercase">{bucket}</p>
                <ol className="mt-1 flex flex-col gap-1">
                  {items.map((s) => {
                    const isDone = done[s.id];
                    const isCurrent = s.id === step;
                    return (
                      <li key={s.id}>
                        <div
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${
                            isCurrent
                              ? "bg-white/12 font-medium text-white"
                              : isDone
                                ? "text-white/85"
                                : "text-white/35"
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
            ))}
          </div>
        </div>

        <p className="text-xs text-white/40">
          Step {stepIndex + 1} of {visibleSteps.length}
        </p>
      </aside>

      <main className="flex-1 bg-[var(--background-tint)] px-6 py-14 sm:px-14">
        <div className="mx-auto max-w-xl">
          {step === "business" && (
            <BusinessStep
              initial={initialBusiness}
              onDone={() => {
                setDone((prev) => ({ ...prev, business: true }));
                setStep("role");
              }}
            />
          )}
          {step === "role" && (
            <RoleStep
              onDone={() => {
                setDone((prev) => ({ ...prev, role: true }));
                setStep("experience");
              }}
            />
          )}
          {step === "experience" && (
            <ExperienceStep
              onDone={() => {
                setDone((prev) => ({ ...prev, experience: true }));
                setStep("motion");
              }}
            />
          )}
          {step === "motion" && <MotionStep onDone={advanceFromMotion} />}
          {step === "metrics" && (
            <MetricsStep
              onDone={() => {
                setDone((prev) => ({ ...prev, metrics: true }));
                finish();
              }}
            />
          )}
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
          <button
            type="button"
            onClick={confirm}
            disabled={isPending || fields.name.trim() === ""}
            className={primaryButtonClass}
          >
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
        Continue <ArrowRightIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function MotionStep({ onDone }: { onDone: (answer: "yes" | "no") => void }) {
  const [answer, setAnswer] = useState<"yes" | "no" | "">("");
  const [isPending, startTransition] = useTransition();

  function confirm() {
    if (!answer) return;
    startTransition(async () => {
      await saveHasExistingMotion(answer);
      onDone(answer);
    });
  }

  return (
    <div>
      <span className={eyebrowClass}>Onboarding · Sales motion</span>
      <h1 className={headlineClass}>Do you have an existing sales motion?</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        One fork, used everywhere after this — if you&apos;re still zero to one, the next screen won&apos;t ask you
        for real funnel numbers you don&apos;t have yet.
      </p>
      <OptionList
        value={answer}
        onChange={(v) => setAnswer(v as "yes" | "no")}
        options={[
          { value: "yes", label: "Yes — we have an existing motion and real numbers to look at" },
          { value: "no", label: "No — we're just getting started" },
        ]}
      />
      <button type="button" onClick={confirm} disabled={isPending || !answer} className={primaryButtonClass}>
        Continue <ArrowRightIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const EMPTY_SOURCE: Omit<SourceInput, "source"> = {
  leads: 0,
  sets: 0,
  meetings: 0,
  opportunities: 0,
  closed_won: 0,
  arr: 0,
  cycle_length_days: 0,
};

const COUNT_FIELDS: { name: keyof typeof EMPTY_SOURCE; label: string }[] = [
  { name: "leads", label: "Leads" },
  { name: "sets", label: "Meetings set" },
  { name: "meetings", label: "Meetings held" },
  { name: "opportunities", label: "Opportunities" },
  { name: "closed_won", label: "Closed won" },
  { name: "arr", label: "ARR ($)" },
  { name: "cycle_length_days", label: "Cycle length (days)" },
];

function formatPct(n: number) {
  return `${Math.round(n * 100)}%`;
}
function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function MetricsStep({ onDone }: { onDone: () => void }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Record<string, Omit<SourceInput, "source">>>({});
  const [isPending, startTransition] = useTransition();

  function toggle(source: string) {
    setEnabled((prev) => ({ ...prev, [source]: !prev[source] }));
    setRows((prev) => (prev[source] ? prev : { ...prev, [source]: { ...EMPTY_SOURCE } }));
  }

  function updateField(source: string, field: keyof typeof EMPTY_SOURCE, value: string) {
    const n = Number(value.replace(/[^0-9.]/g, "")) || 0;
    setRows((prev) => ({ ...prev, [source]: { ...prev[source], [field]: n } }));
  }

  const activeSources: SourceInput[] = LEAD_SOURCES.filter((s) => enabled[s.value]).map((s) => ({
    source: s.value,
    ...(rows[s.value] ?? EMPTY_SOURCE),
  }));
  const computed = useMemo(() => activeSources.map(computeSourceMetrics), [activeSources]);
  const blended = useMemo(() => computeBlended(computed), [computed]);
  const hasAnyData = activeSources.length > 0;

  function confirm() {
    startTransition(async () => {
      await saveLeadSources(activeSources);
      onDone();
    });
  }

  function defer() {
    startTransition(async () => {
      await deferLeadSources();
      onDone();
    });
  }

  return (
    <div>
      <span className={eyebrowClass}>Onboarding · Sales motion</span>
      <h1 className={headlineClass}>Metrics, by lead source</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Turn on the sources you actually track. Enter counts only — set rate, keep rate, opp rate, close rate, ARPA,
        and velocity are always calculated, never typed, so a number here can never disagree with your own counts.
      </p>

      {hasAnyData && (
        <div className="mt-6 rounded-2xl border border-[var(--sails-blue)]/30 bg-[var(--sails-blue-light)] p-4">
          <p className={pillClass + " bg-white/60"}>All sources</p>
          <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2 text-sm sm:grid-cols-6">
            <Stat label="Set rate" value={formatPct(blended.setRate)} />
            <Stat label="Keep rate" value={formatPct(blended.keepRate)} />
            <Stat label="Opp rate" value={formatPct(blended.oppRate)} />
            <Stat label="Close rate" value={formatPct(blended.closeRate)} />
            <Stat label="ARPA" value={formatMoney(blended.arpa)} />
            <Stat label="Velocity/day" value={formatMoney(blended.velocity)} />
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {LEAD_SOURCES.map((s) => {
          const isOn = !!enabled[s.value];
          const row = rows[s.value] ?? EMPTY_SOURCE;
          const sourceComputed = isOn ? computeSourceMetrics({ source: s.value, ...row }) : null;
          return (
            <div
              key={s.value}
              className={`rounded-2xl border bg-[var(--background)] shadow-[var(--shadow-soft)] transition-colors duration-150 ${
                isOn ? "border-[var(--sails-blue)]/30" : "border-[var(--sails-border)]"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(s.value)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <span className="text-sm font-medium text-[var(--foreground)]">{s.label}</span>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    isOn ? "bg-[var(--sails-blue)] text-white" : "bg-[var(--sails-gray)] text-faint"
                  }`}
                >
                  {isOn ? <XIcon className="h-3.5 w-3.5" /> : <PlusIcon className="h-3.5 w-3.5" />}
                </span>
              </button>

              {isOn && (
                <div className="border-t border-[var(--sails-border)] p-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {COUNT_FIELDS.map((f) => (
                      <label key={f.name} className="block">
                        <span className="text-xs font-medium text-muted">{f.label}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row[f.name] === 0 ? "" : String(row[f.name])}
                          onChange={(e) => updateField(s.value, f.name, e.target.value)}
                          placeholder="0"
                          className={fieldClass}
                        />
                      </label>
                    ))}
                  </div>
                  {sourceComputed && (
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-[var(--sails-border)] pt-3 text-xs text-muted">
                      <span>Set {formatPct(sourceComputed.set_rate)}</span>
                      <span>Keep {formatPct(sourceComputed.keep_rate)}</span>
                      <span>Opp {formatPct(sourceComputed.opp_rate)}</span>
                      <span>Close {formatPct(sourceComputed.close_rate)}</span>
                      <span>ARPA {formatMoney(sourceComputed.arpa)}</span>
                      <span>Velocity {formatMoney(sourceComputed.velocity)}/day</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button type="button" onClick={confirm} disabled={isPending || !hasAnyData} className={primaryButtonClass}>
          Looks right — continue <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={defer}
          disabled={isPending}
          className="text-xs text-muted underline decoration-dotted hover:text-[var(--foreground)]"
        >
          I&apos;ll pull these later
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium tracking-wide text-[var(--sails-blue)] uppercase">{label}</div>
      <div className="text-sm font-semibold text-[var(--foreground)]">{value}</div>
    </div>
  );
}
