"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createOrgAndInvite } from "./actions";

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
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 rounded-lg border border-[var(--sails-border)] p-4">
      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">Org name</span>
        <input
          required
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--sails-border)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">Invite email</span>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--sails-border)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">Their name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--sails-border)] px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-[var(--sails-blue)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--sails-navy)] disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create org + invite"}
      </button>
      {status && (
        <p className={`text-sm ${status.ok ? "text-green-700" : "text-red-600"}`}>{status.message}</p>
      )}
    </form>
  );
}
