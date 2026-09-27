from __future__ import annotations

import io
from html import escape
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


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

    document.build(elements)

    buffer.seek(0)
    return buffer.read()