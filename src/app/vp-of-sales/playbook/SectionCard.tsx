"use client";

import { useState, useTransition } from "react";
import {
  CheckCircleIcon,
  CircleIcon,
  AlertTriangleIcon,
  ChevronRightIcon,
  SparkleIcon,
} from "@/components/icons";
import { MarkdownLite } from "./MarkdownLite";
import { regenerateSection, approveSection } from "./actions";

type Status = "empty" | "draft" | "approved" | "stale";

const STATUS_META: Record<Status, { label: string; icon: typeof CircleIcon; className: string }> = {
  empty: { label: "Not started", icon: CircleIcon, className: "text-faint" },
  draft: { label: "Draft", icon: SparkleIcon, className: "text-[var(--sails-blue)]" },
  stale: { label: "Needs regeneration", icon: AlertTriangleIcon, className: "text-warning" },
  approved: { label: "Approved", icon: CheckCircleIcon, className: "text-success" },
};

export function SectionCard({
  slug,
  title,
  status,
  content,
  stepNumber,
}: {
  slug: string;
  title: string;
  status: Status;
  content: string | null;
  stepNumber: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] shadow-[var(--shadow-soft)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sails-blue-light)] text-[var(--sails-blue)] text-xs font-medium">
          {stepNumber}
        </span>
        <h3 className="font-medium text-[var(--foreground)]">{title}</h3>
        <span className={`ml-auto flex items-center gap-1.5 text-xs font-medium ${meta.className}`}>
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {meta.label}
        </span>
        <ChevronRightIcon
          className={`h-4 w-4 shrink-0 text-faint transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-[var(--sails-border)] px-5 py-4">
          {content ? (
            <MarkdownLite text={content} />
          ) : (
            <p className="text-sm text-muted">
              Nothing here yet — complete the exercises that feed this section, then generate it.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => regenerateSection(slug))}
              className="rounded-full bg-[var(--sails-blue-light)] px-3.5 py-1.5 text-xs font-medium text-[var(--sails-blue)] transition-colors duration-150 hover:bg-[var(--sails-blue)] hover:text-white disabled:opacity-50"
            >
              {isPending ? "Working..." : status === "empty" ? "Generate" : "Regenerate"}
            </button>
            {content && status !== "approved" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => approveSection(slug))}
                className="rounded-full border border-[var(--sails-border)] px-3.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--sails-gray)] disabled:opacity-50"
              >
                Approve
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
