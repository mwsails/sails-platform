"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircleIcon, CompassIcon, ArrowRightIcon } from "@/components/icons";

const fieldClass =
  "rounded-lg border border-[var(--sails-border)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sails-blue)]/40 focus:border-[var(--sails-blue)]";

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
    <main className="relative flex min-h-[calc(100vh-73px)] items-center justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: "radial-gradient(50% 40% at 50% 0%, var(--sails-blue-light) 0%, transparent 70%)",
        }}
      />
      <div className="w-full max-w-sm rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-8 shadow-[var(--shadow-soft-hover)]">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sails-blue-light)] text-[var(--sails-blue)]">
          <CompassIcon className="h-5 w-5" />
        </span>
        <h1 className="mt-4 font-[family-name:var(--font-serif)] text-2xl font-semibold text-[var(--foreground)]">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-muted">
          Invite-only. Enter the email your org invited you with and we&apos;ll send a sign-in link.
        </p>

        {status === "sent" ? (
          <div className="mt-6 flex items-center gap-3 rounded-xl bg-[var(--sails-blue-light)] p-4 text-sm text-[var(--foreground)]">
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-[var(--sails-blue)]" />
            Check {email} for a sign-in link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={fieldClass}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--sails-blue)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-all duration-200 ease-[var(--ease-out)] hover:bg-[var(--sails-navy)] hover:shadow-[var(--shadow-soft-hover)] disabled:opacity-50"
            >
              {status === "sending" ? (
                "Sending..."
              ) : (
                <>
                  Send sign-in link
                  <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
            {status === "error" && (
              <p className="text-sm text-red-600">Something went wrong. Try again.</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
