"use client";
import ReportDashboard from "./components/ReportDashboard";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Clarification = {
  column: string;
  detected_type: string;
  confidence: number;
  reason: string;
  sample_values: string[];
};

type AnalyzeResponse =
  | { status: "needs_clarification"; upload_id: string; clarifications: Clarification[] }
  | { status: "complete"; report: any };

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/analyze`, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail || "Erreur lors de l'analyse.");
      }
      const data: AnalyzeResponse = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!result || result.status !== "needs_clarification") return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/analyze/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_id: result.upload_id,
          answers: Object.entries(answers).map(([column, confirmed_type]) => ({
            column,
            confirmed_type,
          })),
        }),
      });
      if (!res.ok) throw new Error("Erreur lors de la confirmation.");
      const data: AnalyzeResponse = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

    return (
    <main>
      {/* ---------- HERO ---------- */}
      <section className="bg-ink text-[#F1EFE8]">
        <div className="max-w-6xl mx-auto px-8 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm tracking-wide text-[#B4B2A9] mb-4">NAAM Analytics</p>
            <h1 className="font-display font-bold text-4xl md:text-5xl leading-tight mb-5">
              Vos fichiers de données,
              <br />
              enfin lisibles
            </h1>
            <p className="text-[#D3D1C7] text-lg mb-8 max-w-md">
              Importe un CSV ou un Excel. On détecte les types de colonnes, les
              valeurs manquantes et les doublons, et on te rend un rapport clair
              en quelques secondes.
            </p>

            <label className="block border border-dashed border-[#5F5E5A] rounded-lg p-6 cursor-pointer hover:border-amber transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleUpload}
                className="hidden"
              />
              <span className="block font-medium mb-1">
                Déposer un fichier ou cliquer pour choisir
              </span>
              <span className="block text-sm text-[#888780]">
                Formats acceptés : .csv, .xlsx — 10 Mo maximum
              </span>
            </label>

            {loading && <p className="mt-4 text-amber">Analyse en cours…</p>}
            {error && <p className="mt-4 text-[#F09595]">{error}</p>}
          </div>

          <div
            className="hidden md:block h-96 rounded-2xl bg-cover bg-center bg-[#0C447C] border border-white/10"
            style={{ backgroundImage: "url('/comores_1.jpg')" }}
          />
        </div>
      </section>

      {result?.status === "needs_clarification" && (
        <section className="max-w-3xl mx-auto px-8 py-14">
          <h2 className="font-display font-bold text-2xl mb-1">Quelques précisions</h2>
          <p className="text-[#5F5E5A] mb-6">
            Certaines colonnes sont ambiguës — confirme leur type pour affiner le rapport.
          </p>
          <div className="space-y-5">
            {result.clarifications.map((c) => (
              <div key={c.column} className="border border-[#D3D1C7] rounded-lg p-5">
                <p className="font-medium mb-1">{c.column}</p>
                <p className="text-sm text-[#5F5E5A] mb-2">{c.reason}</p>
                <p className="text-xs text-[#888780] mb-3">
                  Exemples : {c.sample_values.join(", ")}
                </p>
                <select
                  className="border border-[#D3D1C7] rounded px-3 py-2 text-sm"
                  defaultValue={c.detected_type}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [c.column]: e.target.value }))
                  }
                >
                  <option value="numeric">Numérique</option>
                  <option value="date">Date</option>
                  <option value="categorical">Catégorielle</option>
                  <option value="text">Texte libre</option>
                  <option value="identifier">Identifiant (exclu des stats)</option>
                </select>
              </div>
            ))}
          </div>
          <button
            onClick={handleConfirm}
            className="mt-6 bg-ink text-white px-5 py-3 rounded-lg font-medium hover:bg-ink/90 transition-colors"
          >
            Valider et générer le rapport
          </button>
        </section>
      )}

            {result?.status === "complete" && (
        <section className="max-w-5xl mx-auto px-8 py-14">
          <h2 className="font-display font-bold text-2xl mb-6">Rapport</h2>
          <ReportDashboard report={result.report} />
        </section>
      )}
    </main>
  );
}