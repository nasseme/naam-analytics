"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import ReportDashboard from "../../components/ReportDashboard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function DashboardPage() {
  const params = useParams();
  const id = params.id as string;

  const [report, setReport] = useState<any>(null);
  const [filename, setFilename] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const captureRef = useRef<HTMLDivElement>(null);

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

  async function handleDownloadPdf() {
    if (!captureRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(captureRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      const imgData = canvas.toDataURL("image/png");

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`rapport-${filename || id}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-8 py-14">
      {loading && <p>Chargement du rapport…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {report && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display font-bold text-2xl mb-1">Rapport</h1>
              <p className="text-[#888780]">{filename}</p>
            </div>
            <button
              onClick={handleDownloadPdf}
              disabled={exporting}
              className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors disabled:opacity-50"
            >
              {exporting ? "Génération..." : "Télécharger en PDF"}
            </button>
          </div>

          <div ref={captureRef} className="bg-white">
            <ReportDashboard report={report} />
          </div>
        </>
      )}
    </main>
  );
}