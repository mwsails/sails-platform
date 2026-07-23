export default function AuthCodeErrorPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-xl font-semibold text-[var(--foreground)]">
        That link didn&apos;t work
      </h1>
      <p className="mt-2 text-sm text-muted">
        It may have expired or already been used. Request a new one from the sign-in page.
      </p>
    </main>
  );
}
