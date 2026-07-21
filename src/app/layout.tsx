import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SAILS Platform",
  description: "Build your sales playbook, one exercise at a time.",
};

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/journey", label: "Journey" },
  { href: "/playbook", label: "Playbook" },
  { href: "/library", label: "Library" },
  { href: "/profile", label: "Profile" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-neutral-200">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <span className="font-[family-name:var(--font-serif)] text-lg font-semibold text-[var(--sails-navy)]">
              SAILS
            </span>
            <ul className="flex gap-5 text-sm">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-neutral-600 hover:text-[var(--sails-blue)]">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
