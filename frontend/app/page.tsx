import Link from "next/link";
import { IMAGES } from "../components/pageImages";
import PageHero from "../components/PageHero";


const MODULES = [
  {
    href: "/analyse",
    title: "Analyse de données",
    desc: "Importe un CSV ou un Excel et obtiens un rapport clair en quelques secondes.",
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
    desc: "Pose des questions sur tes propres documents.",
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
    <main>
      <PageHero
        title={
          <>
            Vos données et vos IA,
            <br />
            au même endroit
          </>
        }
        description="Analyse tes fichiers, discute avec plusieurs IA, et bientôt interroge tes documents et prépare des fine-tunings."
        image={IMAGES.home}
      >
        <Link
          href="/analyse"
          className="inline-block bg-amber text-ink px-5 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Commencer l&apos;analyse
        </Link>
      </PageHero>

      <section className="max-w-6xl mx-auto px-8 py-14">
        <h2 className="font-display font-bold text-2xl mb-6">Les modules</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`rounded-lg border p-5 transition-colors hover:border-amber ${
                m.ready ? "border-[#D3D1C7]" : "border-dashed border-[#B4B2A9] text-[#5F5E5A]"
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="font-display font-bold text-lg">{m.title}</span>
                {!m.ready && (
                  <span className="rounded bg-[#F1EFE8] px-1.5 py-0.5 text-xs">Bientôt</span>
                )}
              </div>
              <p className="text-sm text-[#5F5E5A]">{m.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
