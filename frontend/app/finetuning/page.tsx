import { IMAGES } from "../../components/pageImages";
import PageHero from "../../components/PageHero";


export default function FineTuningPage() {
  return (
    <main>
      <PageHero
        title={
          <>
            Entraîne
            <br />
            ton propre modèle
          </>
        }
        description="Prépare un jeu de données et lance le fine-tuning d'un modèle adapté à ton besoin."
        image={IMAGES.finetuning}
      >
        <span className="inline-block rounded-full border border-[#5F5E5A] px-4 py-1.5 text-sm text-[#D3D1C7]">
          Bientôt disponible
        </span>
      </PageHero>
    </main>
  );
}
