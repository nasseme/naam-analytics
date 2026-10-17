"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// L'accueil est "/", l'analyse est déplacée sur "/analyse"
const TABS = [
  { href: "/analyse", label: "Analyse de données", ready: true },
  { href: "/chat", label: "Chat IA", ready: true },
  { href: "/rag", label: "RAG", ready: false },
  { href: "/finetuning", label: "Fine-tuning", ready: false },
];

function isActive(href: string, pathname: string) {
  if (href === "/analyse") return pathname.startsWith("/analyse") || pathname.startsWith("/dashboard");
  return pathname.startsWith(href);
}

export default function TabsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-14 items-center gap-1 border-b px-4" aria-label="Modules">
      <Link href="/" className="mr-4 font-semibold">
        NAAM Analytics
      </Link>
      {TABS.map((tab) =>
        tab.ready ? (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded px-3 py-1.5 text-sm ${
              isActive(tab.href, pathname)
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </Link>
        ) : (
          <span
            key={tab.href}
            aria-disabled="true"
            title="Bientôt disponible"
            className="cursor-not-allowed rounded px-3 py-1.5 text-sm text-gray-400"
          >
            {tab.label}
            <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs">Bientôt</span>
          </span>
        )
      )}
    </nav>
  );
}
