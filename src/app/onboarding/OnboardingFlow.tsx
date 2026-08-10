"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  scrapeBusiness,
  saveBusiness,
  saveBrand,
  saveRole,
  saveExperience,
  saveHasExistingMotion,
  saveTeamRoles,
  saveLeadSources,
  deferLeadSources,
  saveCustomerProfile,
  saveDealShape,
} from "./actions";
import {
  computeSourceMetrics,
  computeBlended,
  LEAD_SOURCES,
  type SourceInput,
  type Blended,
} from "@/lib/onboarding/metrics";
import { TEAM_ROLES } from "@/lib/onboarding/team";
import { CheckCircleIcon, CircleIcon, SparkleIcon, ArrowRightIcon, PlusIcon, XIcon, InfoIcon } from "@/components/icons";

type Step = "business" | "role" | "experience" | "motion" | "team" | "customer" | "metrics" | "deal-shape";

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

type BrandFields = {
  logo: string;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  font_heading: string;
  font_body: string;
};

function isHexColor(v: string): boolean {
  return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(v.trim());
}

// Customer bucket now hosts Who-you-sell-to, Your-funnel, and the
// fallback Your-deal-shape in sequence — Customer has to be known before
// Your funnel so target_customer_size is available the moment funnel data
// (or its absence) lets tier get computed. Deal Shape only ever shows when
// Your funnel didn't produce real data (has_existing_motion is "no", or
// deferred) — see hasFunnelData/metricsHasData below.
const ALL_STEPS: { id: Step; label: string; bucket: string }[] = [
  { id: "business", label: "Your business", bucket: "Business" },
  { id: "role", label: "Your role", bucket: "You" },
  { id: "experience", label: "Your experience", bucket: "You" },
  { id: "motion", label: "Existing motion?", bucket: "Sales motion" },
  { id: "team", label: "Your team", bucket: "Sales motion" },
  { id: "customer", label: "Who you sell to", bucket: "Customer" },
  { id: "metrics", label: "Your funnel", bucket: "Customer" },
  { id: "deal-shape", label: "Your deal shape", bucket: "Customer" },
];

const COMPANY_SIZE_OPTIONS = [
  { value: "micro", label: "Under 20 employees" },
  { value: "small", label: "20-100 employees" },
  { value: "mid_size", label: "100-1,000 employees" },
  { value: "large", label: "1,000+ employees" },
];

const BUYER_TITLE_OPTIONS = [
  { value: "owner_founder", label: "Owner / Founder" },
  { value: "manager", label: "Manager" },
  { value: "director", label: "Director" },
  { value: "vp", label: "VP" },
  { value: "c_suite", label: "C-suite" },
];

const ACV_OPTIONS = [
  { value: "3000", label: "Under $5K" },
  { value: "10000", label: "$5K-$15K" },
  { value: "20000", label: "$15K-$25K" },
  { value: "40000", label: "$25K-$50K" },
  { value: "75000", label: "$50K-$100K" },
  { value: "150000", label: "$100K+" },
];

const CYCLE_LENGTH_OPTIONS = [
  { value: "20", label: "Under 1 month" },
  { value: "60", label: "1 month to 3 months" },
  { value: "135", label: "3 to 6 months" },
  { value: "270", label: "6 months to 1 year" },
  { value: "400", label: "1 year+" },
];

const STAKEHOLDER_COUNT_OPTIONS = [
  { value: "1", label: "Just one" },
  { value: "2", label: "2-3" },
  { value: "4", label: "4-5" },
  { value: "6", label: "6+" },
];

const PROCUREMENT_OPTIONS = [
  { value: "yes", label: "Yes, regularly" },
  { value: "no", label: "Rarely or never" },
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
  teamDone,
  customerDone,
  metricsDone,
  dealShapeDone,
  hasFunnelData,
  hasExistingMotion,
  initialBusiness,
  initialBrand,
}: {
  initialStep: Step;
  businessDone: boolean;
  roleDone: boolean;
  experienceDone: boolean;
  motionDone: boolean;
  teamDone: boolean;
  customerDone: boolean;
  metricsDone: boolean;
  dealShapeDone: boolean;
  hasFunnelData: boolean;
  hasExistingMotion: "yes" | "no" | null;
  initialBusiness: BusinessFields;
  initialBrand: BrandFields;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [done, setDone] = useState({
    business: businessDone,
    role: roleDone,
    experience: experienceDone,
    motion: motionDone,
    team: teamDone,
    customer: customerDone,
    metrics: metricsDone,
    "deal-shape": dealShapeDone,
  });
  const [motionAnswer, setMotionAnswer] = useState<"yes" | "no" | null>(hasExistingMotion);
  // Tri-state, not boolean: null means "Your funnel hasn't run yet this
  // session" (Deal Shape's sidebar visibility should stay conservative,
  // i.e. shown, until we actually know). true means real data was
  // submitted — Deal Shape is redundant and gets skipped entirely. false
  // means deferred — Deal Shape is still needed to collect the routing
  // fields the funnel screen didn't get to derive.
  const [metricsHasData, setMetricsHasData] = useState<boolean | null>(hasFunnelData ? true : null);
  const router = useRouter();

  function finish() {
    router.push("/journey");
    router.refresh();
  }

  // "No" skips straight to Customer — a zero-to-one founder has no team to
  // report, but still has a target market and expected deal shape worth
  // capturing now, same reasoning as onboarding capturing Business before
  // any revenue exists.
  function advanceFromMotion(answer: "yes" | "no") {
    setMotionAnswer(answer);
    setDone((prev) => ({ ...prev, motion: true }));
    setStep(answer === "no" ? "customer" : "team");
  }

  // A "no" motion answer skips Your funnel entirely (there's no funnel to
  // report) straight to the fallback Deal Shape screen; a "yes" answer
  // goes to Your funnel as normal.
  function advanceFromCustomer() {
    setDone((prev) => ({ ...prev, customer: true }));
    setStep(motionAnswer === "no" ? "deal-shape" : "metrics");
  }

  // hasData distinguishes "submitted real numbers" (tier already computed
  // there, Deal Shape is now redundant, done) from "deferred" (Deal Shape
  // still has to collect what wasn't derived).
  function advanceFromMetrics(hasData: boolean) {
    setMetricsHasData(hasData);
    setDone((prev) => ({ ...prev, metrics: true }));
    if (hasData) {
      finish();
    } else {
      setStep("deal-shape");
    }
  }

  // "No" removes Team and Your funnel from the visible flow entirely (a
  // zero-to-one founder has no roles or funnel to report), and once Your
  // funnel has produced real data for a "yes" org, Deal Shape is redundant
  // and drops out too.
  const visibleSteps = ALL_STEPS.filter((s) => {
    if ((s.id === "team" || s.id === "metrics") && motionAnswer === "no") return false;
    if (s.id === "deal-shape" && metricsHasData === true) return false;
    return true;
  });
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
              initialBrand={initialBrand}
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
          {step === "team" && (
            <TeamStep
              onDone={() => {
                setDone((prev) => ({ ...prev, team: true }));
                setStep("customer");
              }}
            />
          )}
          {step === "customer" && <CustomerStep onDone={advanceFromCustomer} />}
          {step === "metrics" && <MetricsStep onDone={advanceFromMetrics} />}
          {step === "deal-shape" && (
            <DealShapeStep
              onDone={() => {
                setDone((prev) => ({ ...prev, "deal-shape": true }));
                finish();
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function BrandKitFields({ brand, updateBrand }: { brand: BrandFields; updateBrand: (name: keyof BrandFields, value: string) => void }) {
  return (
    <div className="flex flex-col gap-3.5 border-t border-[var(--sails-border)] pt-4">
      <span className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">Brand kit</span>
      <label className="block">
        <span className="text-xs font-medium text-muted">Logo URL</span>
        <div className="mt-1 flex items-center gap-2">
          {brand.logo && (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary scraped domain, next/image needs a known allowlist
            <img
              src={brand.logo}
              alt=""
              className="h-9 w-9 shrink-0 rounded-md border border-[var(--sails-border)] bg-[var(--sails-gray)] object-contain"
            />
          )}
          <input
            value={brand.logo}
            onChange={(e) => updateBrand("logo", e.target.value)}
            placeholder="https://yourcompany.com/logo.png"
            className={`${fieldClass} mt-0`}
          />
        </div>
      </label>

      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { name: "color_primary" as const, label: "Primary", placeholder: "#0D1B4B" },
            { name: "color_secondary" as const, label: "Secondary", placeholder: "#2B60BE" },
            { name: "color_accent" as const, label: "Accent", placeholder: "#F4F5F7" },
          ]
        ).map((c) => (
          <label key={c.name} className="block">
            <span className="text-xs font-medium text-muted">{c.label}</span>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="h-9 w-9 shrink-0 rounded-md border border-[var(--sails-border)]"
                style={{ backgroundColor: isHexColor(brand[c.name]) ? brand[c.name] : "transparent" }}
              />
              <input
                value={brand[c.name]}
                onChange={(e) => updateBrand(c.name, e.target.value)}
                placeholder={c.placeholder}
                className={`${fieldClass} mt-0`}
              />
            </div>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-muted">Heading font</span>
          <input
            value={brand.font_heading}
            onChange={(e) => updateBrand("font_heading", e.target.value)}
            placeholder="e.g. Playfair Display"
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Body font</span>
          <input
            value={brand.font_body}
            onChange={(e) => updateBrand("font_body", e.target.value)}
            placeholder="e.g. Inter"
            className={fieldClass}
          />
        </label>
      </div>
    </div>
  );
}

function BusinessStep({
  initial,
  initialBrand,
  onDone,
}: {
  initial: BusinessFields;
  initialBrand: BrandFields;
  onDone: () => void;
}) {
  const [url, setUrl] = useState("");
  const [fields, setFields] = useState<BusinessFields>(initial);
  const [brand, setBrand] = useState<BrandFields>(initialBrand);
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
      setBrand(result.brand);
    });
  }

  function updateField(name: keyof BusinessFields, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  function updateBrand(name: keyof BrandFields, value: string) {
    setBrand((prev) => ({ ...prev, [name]: value }));
  }

  function confirm() {
    startTransition(async () => {
      const trimmed = Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, v.trim()])
      ) as unknown as BusinessFields;
      await Promise.all([saveBusiness(trimmed), saveBrand(brand)]);
      onDone();
    });
  }

  return (
    <div>
      <span className={eyebrowClass}>Onboarding · Business</span>
      <h1 className={headlineClass}>Your business</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Give us the site and we read it — what you sell, your capabilities, your proof points, and your brand kit
        (logo, colors, fonts) so anything generated for you later looks and sounds like you. You correct what we got
        wrong on this same screen. Nothing after this starts blank.
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

          <BrandKitFields brand={brand} updateBrand={updateBrand} />

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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
        <option value="" disabled>
          Select one
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
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

function TeamStep({ onDone }: { onDone: () => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [customRoles, setCustomRoles] = useState<{ value: string; label: string }[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [isPending, startTransition] = useTransition();

  const allRoles = [...TEAM_ROLES, ...customRoles];

  function updateCount(role: string, value: string) {
    const n = Number(value.replace(/[^0-9]/g, "")) || 0;
    setCounts((prev) => ({ ...prev, [role]: n }));
  }

  function addCustomRole() {
    const label = newRoleName.trim();
    if (!label) return;
    const value = slugify(label);
    if (!value || allRoles.some((r) => r.value === value)) return;
    setCustomRoles((prev) => [...prev, { value, label }]);
    setNewRoleName("");
  }

  function confirm() {
    const roles = allRoles.filter((r) => (counts[r.value] ?? 0) > 0).map((r) => ({ role: r.value, count: counts[r.value] }));
    startTransition(async () => {
      await saveTeamRoles(roles);
      onDone();
    });
  }

  return (
    <div>
      <span className={eyebrowClass}>Onboarding · Sales motion</span>
      <h1 className={headlineClass}>Your team today</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        A quick headcount by role. Helps us calibrate the difference between coaching you and coaching a team —
        leave anything you don&apos;t have at zero.
      </p>

      <div className="mt-7 flex flex-col gap-2.5 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-5 shadow-[var(--shadow-soft)]">
        {allRoles.map((r) => (
          <div key={r.value} className="flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--foreground)]">{r.label}</span>
            <input
              type="text"
              inputMode="numeric"
              value={counts[r.value] ? String(counts[r.value]) : ""}
              onChange={(e) => updateCount(r.value, e.target.value)}
              placeholder="0"
              className="w-20 rounded-lg border border-[var(--sails-border)] bg-[var(--background)] px-3 py-1.5 text-right text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sails-blue)]/40 focus:border-[var(--sails-blue)]"
            />
          </div>
        ))}

        <div className="mt-1 flex items-center gap-2 border-t border-[var(--sails-border)] pt-3.5">
          <input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomRole();
              }
            }}
            placeholder="Not on the list? Name another role"
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={addCustomRole}
            disabled={!newRoleName.trim()}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--sails-blue)] transition-colors duration-150 hover:bg-[var(--sails-blue-light)] disabled:opacity-40"
          >
            + Add role
          </button>
        </div>
      </div>

      <button type="button" onClick={confirm} disabled={isPending} className={primaryButtonClass}>
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

const COUNT_FIELDS: { name: keyof typeof EMPTY_SOURCE; label: string; hint: string }[] = [
  {
    name: "leads",
    label: "Leads",
    hint: "People or accounts that came in through this source, before any outreach turned them into a scheduled meeting.",
  },
  {
    name: "sets",
    label: "Meetings set",
    hint: "Leads who agreed to a meeting and put time on the calendar.",
  },
  {
    name: "meetings",
    label: "Meetings held",
    hint: "Meetings that actually happened. Set doesn't always mean held, people no-show.",
  },
  {
    name: "opportunities",
    label: "Opportunities",
    hint: "Meetings that turned into a real, qualified deal in your pipeline.",
  },
  {
    name: "closed_won",
    label: "Closed won",
    hint: "Opportunities that became paying customers.",
  },
  {
    name: "arr",
    label: "ARR ($)",
    hint: "Annual recurring revenue from the deals you closed in this source.",
  },
  {
    name: "cycle_length_days",
    label: "Cycle length (days)",
    hint: "Average number of days from first meeting to closed won.",
  },
];

function HintLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="group/hint relative inline-flex items-center gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <InfoIcon className="h-3 w-3 shrink-0 text-faint" />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-48 -translate-x-1/2 rounded-lg border border-[var(--sails-border)] bg-[var(--background)] p-2.5 text-[11px] leading-snug text-[var(--foreground)] opacity-0 shadow-[var(--shadow-soft-hover)] transition-opacity duration-150 group-hover/hint:opacity-100"
      >
        {hint}
      </span>
    </span>
  );
}

function formatPct(n: number) {
  return `${Math.round(n * 100)}%`;
}
function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Funnel stages are an ordered category (leads through closed won always
 * narrow in that order), not independent categories — a single hue,
 * decreasing in visual weight stage to stage, is the right encoding here
 * (see the dataviz skill's ordinal-ramp guidance), not one color per stage.
 * Bar width is relative to the top of the funnel (leads = 100%); a stage
 * with zero volume still renders a hairline so the row doesn't vanish and
 * silently imply "no data" for a stage that's actually just fully dropped.
 */
function FunnelInfographic({ blended }: { blended: Blended }) {
  const stages: { label: string; value: number }[] = [
    { label: "Leads", value: blended.totalLeads },
    { label: "Meetings set", value: blended.totalSets },
    { label: "Meetings held", value: blended.totalMeetings },
    { label: "Opportunities", value: blended.totalOpportunities },
    { label: "Closed won", value: blended.totalClosedWon },
  ];
  const top = stages[0].value || 1;

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-[var(--sails-blue)]/20 pt-4">
      {stages.map((s, i) => {
        const pct = s.value > 0 ? Math.max((s.value / top) * 100, 3) : 0;
        const prevValue = i > 0 ? stages[i - 1].value : null;
        const stepRate = prevValue ? (prevValue > 0 ? Math.round((s.value / prevValue) * 100) : 0) : null;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-[11px] font-medium text-[var(--foreground)]">{s.label}</span>
            <div className="h-5 flex-1 overflow-hidden rounded-full bg-white/50">
              <div
                className="h-full rounded-full transition-all duration-300 ease-[var(--ease-out)]"
                style={{ width: `${pct}%`, backgroundColor: "var(--sails-blue)", opacity: 1 - i * 0.16 }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted">{s.value}</span>
            <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-faint">
              {stepRate !== null ? `${stepRate}%` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MetricsStep({ onDone }: { onDone: (hasData: boolean) => void }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Record<string, Omit<SourceInput, "source">>>({});
  const [customSources, setCustomSources] = useState<{ value: string; label: string }[]>([]);
  const [newSourceName, setNewSourceName] = useState("");
  const [stakeholderCount, setStakeholderCount] = useState("");
  const [procurementInvolved, setProcurementInvolved] = useState<"yes" | "no" | "">("");
  const [isPending, startTransition] = useTransition();

  const allSources = [...LEAD_SOURCES, ...customSources];

  function toggle(source: string) {
    setEnabled((prev) => ({ ...prev, [source]: !prev[source] }));
    setRows((prev) => (prev[source] ? prev : { ...prev, [source]: { ...EMPTY_SOURCE } }));
  }

  function updateField(source: string, field: keyof typeof EMPTY_SOURCE, value: string) {
    const n = Number(value.replace(/[^0-9.]/g, "")) || 0;
    setRows((prev) => ({ ...prev, [source]: { ...prev[source], [field]: n } }));
  }

  function addCustomSource() {
    const label = newSourceName.trim();
    if (!label) return;
    const value = slugify(label);
    if (!value || allSources.some((s) => s.value === value)) return;
    setCustomSources((prev) => [...prev, { value, label }]);
    setEnabled((prev) => ({ ...prev, [value]: true }));
    setRows((prev) => ({ ...prev, [value]: { ...EMPTY_SOURCE } }));
    setNewSourceName("");
  }

  const activeSources: SourceInput[] = useMemo(
    () => allSources.filter((s) => enabled[s.value]).map((s) => ({ source: s.value, ...(rows[s.value] ?? EMPTY_SOURCE) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allSources is [...LEAD_SOURCES, ...customSources], customSources already covers the only part of it that can change
    [customSources, enabled, rows]
  );
  const computed = useMemo(() => activeSources.map(computeSourceMetrics), [activeSources]);
  const blended = useMemo(() => computeBlended(computed), [computed]);
  const hasAnyData = activeSources.length > 0;
  // stakeholder/procurement only matter once there's real data to derive a
  // tier from (see saveLeadSources) — asking for them before any source is
  // even on would be answering a question the screen hasn't earned yet.
  const readyToSubmit = hasAnyData && stakeholderCount !== "" && procurementInvolved !== "";

  function confirm() {
    if (!readyToSubmit) return;
    startTransition(async () => {
      await saveLeadSources(activeSources, stakeholderCount, procurementInvolved as "yes" | "no");
      onDone(true);
    });
  }

  function defer() {
    startTransition(async () => {
      await deferLeadSources();
      onDone(false);
    });
  }

  return (
    <div>
      <span className={eyebrowClass}>Onboarding · Customer</span>
      <h1 className={headlineClass}>Your funnel</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Turn on the sources you actually track. Based on your last 90 days — a fixed window, not something you pick,
        so your numbers stay comparable over time and against your segment. Enter counts only — set rate, keep rate,
        opp rate, close rate, ARPA, and velocity are always calculated, never typed, so a number here can never
        disagree with your own counts.
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
          <FunnelInfographic blended={blended} />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {allSources.map((s) => {
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
                        <HintLabel label={f.label} hint={f.hint} />
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

        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--sails-border)] bg-transparent px-4 py-3">
          <input
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomSource();
              }
            }}
            placeholder="Not on the list? Name your own source"
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={addCustomSource}
            disabled={!newSourceName.trim()}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--sails-blue)] transition-colors duration-150 hover:bg-[var(--sails-blue-light)] disabled:opacity-40"
          >
            + Add source
          </button>
        </div>
      </div>

      {hasAnyData && (
        <div className="mt-6 flex flex-col gap-3.5 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-5 shadow-[var(--shadow-soft)]">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
            Two more, then we route you to the right track
          </span>
          <SelectField
            label="People typically involved in a buying decision"
            value={stakeholderCount}
            onChange={setStakeholderCount}
            options={STAKEHOLDER_COUNT_OPTIONS}
          />
          <SelectField
            label="Does procurement, legal, or security usually get involved?"
            value={procurementInvolved}
            onChange={(v) => setProcurementInvolved(v as "yes" | "no")}
            options={PROCUREMENT_OPTIONS}
          />
        </div>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button type="button" onClick={confirm} disabled={isPending || !readyToSubmit} className={primaryButtonClass}>
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

function CustomerStep({ onDone }: { onDone: () => void }) {
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [geography, setGeography] = useState("");
  const [buyerTitle, setBuyerTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const complete = industry.trim() !== "" && companySize !== "" && buyerTitle !== "";

  function confirm() {
    if (!complete) return;
    startTransition(async () => {
      await saveCustomerProfile({ industry: industry.trim(), companySize, geography: geography.trim(), buyerTitle });
      onDone();
    });
  }

  return (
    <div>
      <span className={eyebrowClass}>Onboarding · Customer</span>
      <h1 className={headlineClass}>Who you sell to</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Your primary customer, not every edge case you&apos;ve ever closed. Enough for the platform to sound informed
        from your very first conversation — the deeper breakdown comes later.
      </p>

      <div className="mt-7 flex flex-col gap-3.5 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-5 shadow-[var(--shadow-soft)]">
        <label className="block">
          <span className="text-xs font-medium text-muted">Industry</span>
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. B2B fintech"
            className={fieldClass}
          />
        </label>
        <SelectField
          label="Company size they typically buy from you"
          value={companySize}
          onChange={setCompanySize}
          options={COMPANY_SIZE_OPTIONS}
        />
        <label className="block">
          <span className="text-xs font-medium text-muted">Geography (optional)</span>
          <input
            value={geography}
            onChange={(e) => setGeography(e.target.value)}
            placeholder="e.g. North America"
            className={fieldClass}
          />
        </label>
        <SelectField
          label="Title of your typical economic buyer (who signs off)"
          value={buyerTitle}
          onChange={setBuyerTitle}
          options={BUYER_TITLE_OPTIONS}
        />
      </div>

      <button type="button" onClick={confirm} disabled={isPending || !complete} className={primaryButtonClass}>
        Continue <ArrowRightIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DealShapeStep({ onDone }: { onDone: () => void }) {
  const [acv, setAcv] = useState("");
  const [cycleLengthDays, setCycleLengthDays] = useState("");
  const [stakeholderCount, setStakeholderCount] = useState("");
  const [procurementInvolved, setProcurementInvolved] = useState<"yes" | "no" | "">("");
  const [isPending, startTransition] = useTransition();

  const complete = acv !== "" && cycleLengthDays !== "" && stakeholderCount !== "" && procurementInvolved !== "";

  function confirm() {
    if (!complete) return;
    startTransition(async () => {
      await saveDealShape({ acv, cycleLengthDays, stakeholderCount, procurementInvolved: procurementInvolved as "yes" | "no" });
      onDone();
    });
  }

  return (
    <div>
      <span className={eyebrowClass}>Onboarding · Customer</span>
      <h1 className={headlineClass}>Your deal shape</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Typical, not best case or worst case. This is what routes you to the right track and tells the platform how
        complex your deals really are.
      </p>

      <div className="mt-7 flex flex-col gap-3.5 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-5 shadow-[var(--shadow-soft)]">
        <SelectField label="Typical annual contract value (ACV)" value={acv} onChange={setAcv} options={ACV_OPTIONS} />
        <SelectField
          label="Typical sales cycle length"
          value={cycleLengthDays}
          onChange={setCycleLengthDays}
          options={CYCLE_LENGTH_OPTIONS}
        />
        <SelectField
          label="People typically involved in a buying decision"
          value={stakeholderCount}
          onChange={setStakeholderCount}
          options={STAKEHOLDER_COUNT_OPTIONS}
        />
        <SelectField
          label="Does procurement, legal, or security usually get involved?"
          value={procurementInvolved}
          onChange={(v) => setProcurementInvolved(v as "yes" | "no")}
          options={PROCUREMENT_OPTIONS}
        />
      </div>

      <button type="button" onClick={confirm} disabled={isPending || !complete} className={primaryButtonClass}>
        Continue <ArrowRightIcon className="h-3.5 w-3.5" />
      </button>
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
