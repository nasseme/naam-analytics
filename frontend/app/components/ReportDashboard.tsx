"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
    insights?: {
    key_insights: string[];
    ml_suggestions: string[];
    time_series: any[];
    explanatory_relations: any[];
    correlations: any[];
    curves?: Record<string, { x: string | number; y: number }[]>;
  };
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
              {report.insights && (
        <div className="space-y-8">
          {report.insights.time_series.length > 0 && (
            <div>
              <h3 className="font-display font-bold text-lg mb-3">
                Analyse temporelle
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {report.insights.time_series.map((ts: any) => (
                  <div key={ts.column} className="border border-[#D3D1C7] rounded-lg p-4">
                    <p className="font-medium mb-1">{ts.column}</p>
                    <p className="text-sm mb-2">
                      Tendance :{" "}
                      <span
                        className={
                          ts.trend === "hausse"
                            ? "text-green-700"
                            : ts.trend === "baisse"
                            ? "text-red-700"
                            : "text-[#888780]"
                        }
                      >
                        {ts.trend} ({ts.change_pct > 0 ? "+" : ""}
                        {ts.change_pct}%)
                      </span>
                    </p>
                      {ts.seasonality.map((s: any) => (
                      <div key={s.cycle} className="mt-3">
                        <p className="text-xs text-[#888780] mb-1">
                          Saisonnalité {s.cycle} — pic : {s.peak}, creux : {s.low}
                        </p>
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={s.averages}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E4E2D9" />
                              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Bar dataKey="value" fill="#042C53" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.insights.explanatory_relations.length > 0 && (
            <div>
              <h3 className="font-display font-bold text-lg mb-3">
                Facteurs explicatifs
              </h3>
              <div className="overflow-x-auto border border-[#D3D1C7] rounded-lg">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="bg-[#F1EFE8] text-left">
                    <tr>
                      <th className="px-4 py-2">Colonne catégorielle</th>
                      <th className="px-4 py-2">Explique</th>
                      <th className="px-4 py-2">Force (η²)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.insights.explanatory_relations.map((r: any, i: number) => (
                      <tr key={i} className="border-t border-[#D3D1C7]">
                        <td className="px-4 py-2 font-medium">{r.categorical}</td>
                        <td className="px-4 py-2">{r.numeric}</td>
                        <td className="px-4 py-2">{r.eta_squared}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report.insights.correlations.length > 0 && (
            <div>
              <h3 className="font-display font-bold text-lg mb-3">
                Corrélations fortes
              </h3>
              <div className="overflow-x-auto border border-[#D3D1C7] rounded-lg">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="bg-[#F1EFE8] text-left">
                    <tr>
                      <th className="px-4 py-2">Colonne A</th>
                      <th className="px-4 py-2">Colonne B</th>
                      <th className="px-4 py-2">Coefficient (r)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.insights.correlations.map((p: any, i: number) => (
                      <tr key={i} className="border-t border-[#D3D1C7]">
                        <td className="px-4 py-2 font-medium">{p.a}</td>
                        <td className="px-4 py-2">{p.b}</td>
                        <td className="px-4 py-2">{p.r}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {report.insights.curves && (
            <div>
              <h3 className="font-display font-bold text-lg mb-3">
                Courbes des variables numériques
              </h3>
              <div className="space-y-6">
                {Object.entries(report.insights.curves).map(([col, points]) => (
                  <div key={col} className="border border-[#D3D1C7] rounded-lg p-4">
                    <p className="font-medium mb-2">{col}</p>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={points}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E4E2D9" />
                          <XAxis dataKey="x" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="y"
                            stroke="#EF9F27"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {report.insights.ml_suggestions.length > 0 && (
            <div>
              <h3 className="font-display font-bold text-lg mb-3">
                Pistes Machine Learning (V2)
              </h3>
              <ul className="space-y-2">
                {report.insights.ml_suggestions.map((s: string, i: number) => (
                  <li
                    key={i}
                    className="border border-amber/40 bg-amber/5 rounded-lg px-4 py-3 text-sm"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
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
          <table className="w-full text-sm min-w-[600px]">
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
          <table className="w-full text-sm min-w-[600px]">
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
            <table className="w-full text-sm min-w-[600px]">
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