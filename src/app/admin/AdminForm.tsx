"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createOrgAndInvite } from "./actions";
import { CheckCircleIcon, ArrowRightIcon } from "@/components/icons";

const fieldClass =
  "mt-1 w-full rounded-lg border border-[var(--sails-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sails-blue)]/40 focus:border-[var(--sails-blue)]";

export function AdminForm() {
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createOrgAndInvite(orgName, email, name);
        setStatus({ ok: true, message: `Created "${orgName}" and invited ${email}.` });
        setOrgName("");
        setEmail("");
        setName("");
      } catch (err) {
        setStatus({ ok: false, message: err instanceof Error ? err.message : String(err) });
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex flex-col gap-3.5 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-5 shadow-[var(--shadow-soft)]"
    >
      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">Org name</span>
        <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} className={fieldClass} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">Invite email</span>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">Their name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="group inline-flex w-fit items-center gap-2 rounded-full bg-[var(--sails-blue)] px-5 py-2 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-all duration-200 ease-[var(--ease-out)] hover:bg-[var(--sails-navy)] hover:shadow-[var(--shadow-soft-hover)] disabled:opacity-50"
      >
        {isPending ? (
          "Creating..."
        ) : (
          <>
            Create org + invite
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </>
        )}
      </button>
      {status && (
        <p
          className={`flex items-center gap-1.5 text-sm ${status.ok ? "text-emerald-600" : "text-red-600"}`}
        >
          {status.ok && <CheckCircleIcon className="h-4 w-4 shrink-0" />}
          {status.message}
        </p>
      )}
    </form>
  );
}
