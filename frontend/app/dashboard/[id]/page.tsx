"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReportDashboard from "../../components/ReportDashboard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function DashboardPage() {
  const params = useParams();
  const id = params.id as string;

  const [report, setReport] = useState<any>(null);
  const [filename, setFilename] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`${API_URL}/reports/${id}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || "Rapport introuvable.");
        }
        const data = await res.json();
        setReport(data.report);
        setFilename(data.filename);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [id]);

  return (
    <main className="max-w-5xl mx-auto px-8 py-14">
      {loading && <p>Chargement du rapport…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {report && (
        <>
          <h1 className="font-display font-bold text-2xl mb-1">Rapport</h1>
          <p className="text-[#888780] mb-6">{filename}</p>
          <ReportDashboard report={report} />
        </>
      )}
    </main>
  );
}