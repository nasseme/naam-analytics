"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ColumnAnalysis = {
  name: string;
  detected_type: string;
  confidence: number;
  missing_count: number;
  missing_pct: number;
  unique_count: number;
  sample_values: string[];
};

type Report = {
  rows: number;
  columns: number;
  duplicates: number;
  preview: Record<string, string>[];
  columns_analysis: ColumnAnalysis[];
  descriptive_stats: Record<string, Record<string, string>>;
};

const TYPE_LABELS: Record<string, string> = {
  numeric: "Numérique",
  date: "Date",
  categorical: "Catégorielle",
  text: "Texte libre",
  identifier: "Identifiant",
  unknown: "Inconnu",
};

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-[#D3D1C7] rounded-lg p-5">
      <p className="text-sm text-[#888780] mb-1">{label}</p>
      <p className="font-display font-bold text-2xl text-ink">{value}</p>
    </div>
  );
}

export default function ReportDashboard({ report }: { report: Report }) {
  const missingData = report.columns_analysis
    .filter((c) => c.missing_pct > 0)
    .map((c) => ({ name: c.name, missing: c.missing_pct }));

  const previewColumns =
    report.preview.length > 0 ? Object.keys(report.preview[0]) : [];

  const statsColumns = Object.keys(report.descriptive_stats);
  const statsRows =
    statsColumns.length > 0
      ? Object.keys(report.descriptive_stats[statsColumns[0]])
      : [];

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Lignes" value={report.rows} />
        <SummaryCard label="Colonnes" value={report.columns} />
        <SummaryCard label="Doublons" value={report.duplicates} />
        <SummaryCard
          label="Colonnes à surveiller"
          value={report.columns_analysis.filter((c) => c.missing_pct > 0).length}
        />
      </div>

      <div>
        <h3 className="font-display font-bold text-lg mb-3">Colonnes détectées</h3>
        <div className="overflow-x-auto border border-[#D3D1C7] rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-[#F1EFE8] text-left">
              <tr>
                <th className="px-4 py-2">Colonne</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Confiance</th>
                <th className="px-4 py-2">Manquant</th>
                <th className="px-4 py-2">Valeurs uniques</th>
              </tr>
            </thead>
            <tbody>
              {report.columns_analysis.map((c) => (
                <tr key={c.name} className="border-t border-[#D3D1C7]">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2">
                    {TYPE_LABELS[c.detected_type] || c.detected_type}
                  </td>
                  <td className="px-4 py-2">{Math.round(c.confidence * 100)}%</td>
                  <td className="px-4 py-2">
                    {c.missing_count} ({c.missing_pct}%)
                  </td>
                  <td className="px-4 py-2">{c.unique_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {missingData.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-lg mb-3">
            Valeurs manquantes par colonne
          </h3>
          <div className="border border-[#D3D1C7] rounded-lg p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={missingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E2D9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis unit="%" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="missing" fill="#EF9F27" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div>
        <h3 className="font-display font-bold text-lg mb-3">
          Aperçu (10 premières lignes)
        </h3>
        <div className="overflow-x-auto border border-[#D3D1C7] rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-[#F1EFE8] text-left">
              <tr>
                {previewColumns.map((col) => (
                  <th key={col} className="px-4 py-2 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.preview.map((row, i) => (
                <tr key={i} className="border-t border-[#D3D1C7]">
                  {previewColumns.map((col) => (
                    <td key={col} className="px-4 py-2 whitespace-nowrap">
                      {row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {statsColumns.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-lg mb-3">
            Statistiques descriptives
          </h3>
          <div className="overflow-x-auto border border-[#D3D1C7] rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-[#F1EFE8] text-left">
                <tr>
                  <th className="px-4 py-2"></th>
                  {statsColumns.map((col) => (
                    <th key={col} className="px-4 py-2 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statsRows.map((statName) => (
                  <tr key={statName} className="border-t border-[#D3D1C7]">
                    <td className="px-4 py-2 font-medium text-[#888780]">
                      {statName}
                    </td>
                    {statsColumns.map((col) => (
                      <td key={col} className="px-4 py-2 whitespace-nowrap">
                        {report.descriptive_stats[col][statName]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}