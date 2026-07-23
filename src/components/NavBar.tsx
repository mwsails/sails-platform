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

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--sails-border)] bg-[var(--background)]/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-3.5">
        <Link
          href="/"
          className="mr-4 font-[family-name:var(--font-serif)] text-lg font-semibold tracking-tight text-[var(--foreground)]"
        >
          SAILS
        </Link>
        <ul className="flex gap-1 text-sm">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 font-medium transition-colors duration-150 ${
                    active
                      ? "bg-[var(--sails-blue-light)] text-[var(--sails-blue)]"
                      : "text-muted hover:bg-[var(--sails-gray)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
