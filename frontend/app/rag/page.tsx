import { IMAGES } from "../../components/pageImages";
import PageHero from "../../components/PageHero";


export default function RagPage() {
  return (
    <main>
      <PageHero
        title={
          <>
            Interroge
            <br />
            tes documents
          </>
        }
        description="Ajoute tes documents et pose-leur des questions : l'IA répond en s'appuyant sur leur contenu."
        image={IMAGES.rag}
      >
        <span className="inline-block rounded-full border border-[#5F5E5A] px-4 py-1.5 text-sm text-[#D3D1C7]">
          Bientôt disponible
        </span>
      </PageHero>
    </main>
  );
}
