import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-start justify-center px-6 py-24">
      <h1 className="font-[family-name:var(--font-serif)] text-4xl font-semibold text-[var(--sails-navy)]">
        Build your sales playbook.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-neutral-600">
        Guided exercises that feed a shared context profile, so every exercise
        already knows what the last one built. The output is a living
        playbook, not a certificate.
      </p>
      <Link
        href="/journey"
        className="mt-8 rounded-full bg-[var(--sails-blue)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--sails-navy)]"
      >
        Start your journey
      </Link>
    </main>
  );
}
