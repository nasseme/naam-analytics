import "./globals.css";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700"],
});

export const metadata = {
  title: "NAAM Analytics - Plateforme d'analyse de données & IA",
  description: "Importe un fichier CSV ou Excel et obtiens un rapport de qualité de données clair.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={spaceGrotesk.variable}>
      <body className="bg-white text-ink">{children}</body>
    </html>
  );
}