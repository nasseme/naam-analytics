from __future__ import annotations

import io
from html import escape
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.lineplots import LinePlot

INK = colors.HexColor("#042C53")
LIGHT = colors.HexColor("#F1F5F9")


def safe_text(value: Any, limit: int = 35) -> str:
    text = str(value if value is not None else "")
    text = text.replace("\n", " ").replace("\r", " ").strip()

    if len(text) > limit:
        text = text[: limit - 3] + "..."

    return escape(text)


def create_table(data: list[list[Any]], widths: list[float] | None = None) -> Table:
    table = Table(data, colWidths=widths, repeatRows=1)

    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), INK),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )

    return table
def _line_chart(points: list[dict]) -> Drawing:
    width, height = 450, 150
    drawing = Drawing(width, height)
    plot = LinePlot()
    plot.x, plot.y = 30, 20
    plot.width, plot.height = width - 60, height - 40
    plot.data = [[(i, p["y"]) for i, p in enumerate(points)]]
    plot.lines[0].strokeColor = INK
    plot.lines[0].strokeWidth = 1.5
    plot.joinedLines = 1
    plot.xValueAxis.visibleGrid = True
    plot.yValueAxis.visibleGrid = True
    drawing.add(plot)
    return drawing

def generate_pdf(filename: str, report: dict[str, Any]) -> bytes:
    buffer = io.BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
        leftMargin=1.2 * cm,
        rightMargin=1.2 * cm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "NaamTitle",
        parent=styles["Title"],
        textColor=INK,
        fontSize=20,
    )

    section_style = ParagraphStyle(
        "NaamSection",
        parent=styles["Heading2"],
        textColor=INK,
        fontSize=13,
        spaceBefore=16,
        spaceAfter=8,
    )

    elements = [
        Paragraph("NAAM Analytics — Rapport d'analyse", title_style),
        Spacer(1, 8),
        Paragraph(f"Fichier : {safe_text(filename, 100)}", styles["Normal"]),
        Spacer(1, 14),
    ]

    summary = [
        ["Indicateur", "Valeur"],
        ["Nombre de lignes", safe_text(report.get("rows", 0))],
        ["Nombre de colonnes", safe_text(report.get("columns", 0))],
        ["Doublons détectés", safe_text(report.get("duplicates", 0))],
    ]

    elements.append(create_table(summary, [8 * cm, 8 * cm]))

    columns_analysis = report.get("columns_analysis", [])

    if columns_analysis:
        elements.append(Paragraph("Analyse des colonnes", section_style))

        rows = [
            ["Colonne", "Type", "Confiance", "Manquants", "Valeurs uniques"]
        ]

        for column in columns_analysis:
            confidence = float(column.get("confidence", 0)) * 100

            rows.append(
                [
                    safe_text(column.get("name", "")),
                    safe_text(column.get("detected_type", "")),
                    f"{confidence:.0f}%",
                    f"{column.get('missing_count', 0)} ({column.get('missing_pct', 0)}%)",
                    safe_text(column.get("unique_count", 0)),
                ]
            )

        elements.append(
            create_table(
                rows,
                [6 * cm, 4 * cm, 3 * cm, 6 * cm, 4 * cm],
            )
        )

    preview = report.get("preview", [])

    if preview:
        elements.append(Paragraph("Aperçu des données", section_style))

        preview_columns = list(preview[0].keys())[:6]

        preview_rows = [[safe_text(col, 20) for col in preview_columns]]

        for row in preview[:10]:
            preview_rows.append(
                [safe_text(row.get(col, ""), 28) for col in preview_columns]
            )

        width = 25.5 * cm / len(preview_columns)

        elements.append(
            create_table(
                preview_rows,
                [width] * len(preview_columns),
            )
        )

    insights = report.get("insights")
    if insights:
        if insights.get("time_series"):
            elements.append(Paragraph("Analyse temporelle", h2_style))
            for ts in insights["time_series"]:
                elements.append(
                    Paragraph(
                        f"<b>{ts['column']}</b> — tendance : {ts['trend']} "
                        f"({ts['change_pct']:+.1f}%)",
                        styles["Normal"],
                    )
                )
                for s in ts.get("seasonality", []):
                    elements.append(
                        Paragraph(
                            f"Saisonnalité {s['cycle']} — pic : {s['peak']}, "
                            f"creux : {s['low']}",
                            styles["Normal"],
                        )
                    )
                elements.append(Spacer(1, 6))

        if insights.get("explanatory_relations"):
            elements.append(Paragraph("Facteurs explicatifs", h2_style))
            rel_rows = [["Colonne catégorielle", "Explique", "Force (η²)"]]
            for r in insights["explanatory_relations"]:
                rel_rows.append([r["categorical"], r["numeric"], str(r["eta_squared"])])
            elements.append(_table(rel_rows))

        if insights.get("correlations"):
            elements.append(Paragraph("Corrélations fortes", h2_style))
            corr_rows = [["Colonne A", "Colonne B", "Coefficient (r)"]]
            for p in insights["correlations"]:
                corr_rows.append([p["a"], p["b"], str(p["r"])])
            elements.append(_table(corr_rows))

        if insights.get("ml_suggestions"):
            elements.append(Paragraph("Pistes Machine Learning (V2)", h2_style))
            for s in insights["ml_suggestions"]:
                elements.append(Paragraph(f"• {s}", styles["Normal"]))

        curves = insights.get("curves")
        if curves:
            elements.append(Paragraph("Courbes des variables numériques", h2_style))
            for col, points in curves.items():
                elements.append(Paragraph(col, styles["Normal"]))
                elements.append(_line_chart(points))
                elements.append(Spacer(1, 10))        

    document.build(elements)

    buffer.seek(0)
    return buffer.read()