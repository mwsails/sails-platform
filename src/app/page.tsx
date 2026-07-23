import Link from "next/link";
import { ArrowRightIcon, CompassIcon, SparkleIcon, TargetIcon, UsersIcon, DocumentIcon } from "@/components/icons";

const STEPS = [
  { icon: CompassIcon, label: "Diagnostic" },
  { icon: TargetIcon, label: "ICP" },
  { icon: SparkleIcon, label: "Messaging" },
  { icon: UsersIcon, label: "Personas" },
  { icon: DocumentIcon, label: "Playbook" },
];

const FEATURES = [
  {
    icon: CompassIcon,
    title: "Guided, not generic",
    body: "Exercises sequenced to your track — SMB, mid-market, or enterprise-in-waiting.",
  },
  {
    icon: SparkleIcon,
    title: "Context compounds",
    body: "Exercise 12 already knows the ICP, personas, and messaging you built in exercise 1.",
  },
  {
    icon: DocumentIcon,
    title: "A playbook, not a badge",
    body: "The output is a living document your team actually uses, not a completion certificate.",
  },
];

export default function Home() {
  return (
    <main>
      <section className="relative overflow-hidden px-6 pt-20 pb-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 15% 0%, var(--sails-blue-light) 0%, transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sails-blue-light)] px-3 py-1 text-xs font-medium text-[var(--sails-blue)]">
            <SparkleIcon className="h-3.5 w-3.5" />
            Built for velocity sales motions
          </span>
          <h1 className="mt-5 font-[family-name:var(--font-serif)] text-5xl font-semibold leading-[1.1] tracking-tight text-[var(--foreground)]">
            Build your <span className="text-[var(--sails-blue)]">sales playbook</span>, one
            exercise at a time.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Guided exercises that feed a shared context profile, so every exercise already knows
            what the last one built. The output is a living playbook, not a certificate.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link
              href="/journey"
              className="group inline-flex items-center gap-2 rounded-full bg-[var(--sails-blue)] px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-all duration-200 ease-[var(--ease-out)] hover:bg-[var(--sails-navy)] hover:shadow-[var(--shadow-soft-hover)]"
            >
              Start your journey
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 pb-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-4 shadow-[var(--shadow-soft)] sm:gap-0 sm:divide-x sm:divide-[var(--sails-border)]">
            {STEPS.map((step, i) => (
              <div key={step.label} className="flex flex-1 items-center gap-2 px-3 py-1.5 sm:justify-center">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sails-blue-light)] text-[var(--sails-blue)]">
                  <step.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-[var(--foreground)]">{step.label}</span>
                {i < STEPS.length - 1 && (
                  <ArrowRightIcon className="ml-1 hidden h-3.5 w-3.5 text-faint sm:hidden" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-5 shadow-[var(--shadow-soft)] transition-shadow duration-200 hover:shadow-[var(--shadow-soft-hover)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sails-blue-light)] text-[var(--sails-blue)]">
                <f.icon className="h-4.5 w-4.5" />
              </span>
              <h3 className="mt-3 font-medium text-[var(--foreground)]">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
