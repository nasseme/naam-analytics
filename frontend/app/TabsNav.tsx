"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/analyse", label: "Analyse de données", ready: true },
  { href: "/chat", label: "Chat IA", ready: true },
  { href: "/rag", label: "RAG", ready: false },
  { href: "/finetuning", label: "Fine-tuning", ready: false },
];

function isActive(href: string, pathname: string) {
  if (href === "/analyse")
    return pathname.startsWith("/analyse") || pathname.startsWith("/dashboard");
  return pathname.startsWith(href);
}

export default function TabsNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-ink text-[#F1EFE8] border-b border-white/10" aria-label="Modules">
      {/* Défilement horizontal sur petit écran pour que les 4 onglets restent accessibles */}
      <div className="max-w-6xl mx-auto flex h-14 items-center gap-1 overflow-x-auto whitespace-nowrap px-4 sm:px-8">
        <Link href="/" className="mr-4 shrink-0 font-display font-bold">
          NAAM Analytics
        </Link>
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 rounded px-3 py-1.5 text-sm transition-colors ${
              isActive(tab.href, pathname)
                ? "bg-white/10 text-amber"
                : tab.ready
                ? "text-[#D3D1C7] hover:bg-white/10"
                : "text-[#888780] hover:bg-white/5"
            }`}
          >
            {tab.label}
            {!tab.ready && (
              <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-xs">Bientôt</span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
