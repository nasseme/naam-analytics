import Link from "next/link";

const MODULES = [
  {
    href: "/analyse",
    title: "Analyse de données",
    desc: "Charge un fichier CSV et obtiens un rapport automatique.",
    ready: true,
  },
  {
    href: "/chat",
    title: "Chat IA",
    desc: "Choisis une IA, connecte-toi et discute.",
    ready: true,
  },
  {
    href: "/rag",
    title: "RAG",
    desc: "Pose des questions sur tes documents.",
    ready: false,
  },
  {
    href: "/finetuning",
    title: "Fine-tuning",
    desc: "Prépare l'entraînement d'un modèle.",
    ready: false,
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      {/* Emplacement de ton image (ex. <Image src="/hero.png" ... /> avec le fichier dans /public) */}
      <h1 className="mb-1 text-2xl font-semibold">NAAM Analytics</h1>
      <p className="mb-6 text-gray-500">Analyse tes données et travaille avec plusieurs IA.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.map((m) =>
          m.ready ? (
            <Link
              key={m.href}
              href={m.href}
              className="rounded-lg border p-5 transition hover:border-blue-600"
            >
              <div className="mb-1 text-lg font-medium">{m.title}</div>
              <p className="text-sm text-gray-500">{m.desc}</p>
            </Link>
          ) : (
            <Link
              key={m.href}
              href={m.href}
              className="rounded-lg border border-dashed p-5 text-gray-500"
            >
              <div className="mb-1 flex items-center gap-2 text-lg font-medium">
                {m.title}
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">Bientôt</span>
              </div>
              <p className="text-sm">{m.desc}</p>
            </Link>
          )
        )}
      </div>
    </main>
  );
}
