"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompassIcon, DocumentIcon, UsersIcon, BuildingIcon } from "./icons";

const NAV_ITEMS = [
  { href: "/journey", label: "Journey", icon: CompassIcon },
  { href: "/playbook", label: "Playbook", icon: DocumentIcon },
  { href: "/library", label: "Library", icon: BuildingIcon },
  { href: "/profile", label: "Profile", icon: UsersIcon },
];

export function NavBar() {
  const pathname = usePathname();

  // Onboarding is a corridor, not the product — no nav during it, so there's
  // nothing to navigate away to before Foundation exists. It returns once
  // onboarding hands off to /journey.
  if (pathname?.startsWith("/onboarding")) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--sails-border)] bg-[var(--background)]/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3.5 sm:px-6">
        <Link
          href="/"
          className="mr-2 shrink-0 font-[family-name:var(--font-serif)] text-lg font-semibold tracking-tight text-[var(--foreground)] sm:mr-4"
        >
          SAILS
        </Link>
        <ul className="flex min-w-0 flex-1 gap-1 overflow-x-auto text-sm">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-2 font-medium transition-colors duration-150 sm:px-3.5 ${
                    active
                      ? "bg-[var(--sails-blue-light)] text-[var(--sails-blue)]"
                      : "text-muted hover:bg-[var(--sails-gray)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
