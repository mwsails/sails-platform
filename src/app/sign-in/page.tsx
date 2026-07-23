"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col justify-center px-6 py-24">
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-[var(--foreground)]">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-muted">
        Invite-only. Enter the email your org invited you with and we&apos;ll send a sign-in link.
      </p>

      {status === "sent" ? (
        <p className="mt-6 rounded-lg bg-[var(--sails-gray)] p-4 text-sm text-[var(--foreground)]">
          Check {email} for a sign-in link.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="rounded-md border border-[var(--sails-border)] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-full bg-[var(--sails-blue)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--sails-navy)] disabled:opacity-50"
          >
            {status === "sending" ? "Sending..." : "Send sign-in link"}
          </button>
          {status === "error" && (
            <p className="text-sm text-red-600">Something went wrong. Try again.</p>
          )}
        </form>
      )}
    </main>
  );
}
