import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  description: string;
  /** Chemin d'une image placée dans le dossier /public, ex. "/comores_1.jpg" */
  image: string;
  /** Zone sous la description (bouton, badge, upload...) */
  children?: ReactNode;
};

// Même rendu que le haut de la page d'analyse : fond sombre, texte à gauche,
// image à droite sur PC, image au-dessus du texte sur téléphone.
export default function PageHero({
  eyebrow = "NAAM Analytics",
  title,
  description,
  image,
  children,
}: Props) {
  return (
    <section className="bg-ink text-[#F1EFE8]">
      <div className="max-w-6xl mx-auto px-8 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-sm tracking-wide text-[#B4B2A9] mb-4">{eyebrow}</p>
          <h1 className="font-display font-bold text-4xl md:text-5xl leading-tight mb-5">
            {title}
          </h1>
          <p className="text-[#D3D1C7] text-lg mb-8 max-w-md">{description}</p>
          {children}
        </div>

        <div
          className="h-48 md:h-96 rounded-2xl bg-cover bg-center bg-[#0C447C] border border-white/10 order-first md:order-none"
          style={{ backgroundImage: `url('${image}')` }}
        />
      </div>
    </section>
  );
}
