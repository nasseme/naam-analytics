"""
Détection du type de chaque colonne d'un DataFrame, avec un score de confiance.
Si la confiance est basse, la colonne est renvoyée dans la liste des
"clarifications nécessaires" pour que le frontend pose une question à l'utilisateur.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import pandas as pd

DATE_PATTERNS = [
    r"^\d{4}-\d{2}-\d{2}$",          # 2024-04-03 (ISO, sans ambiguïté)
    r"^\d{4}/\d{2}/\d{2}$",
]
AMBIGUOUS_DATE_PATTERNS = [
    r"^\d{1,2}/\d{1,2}/\d{2,4}$",    # 03/04/2024 -> jour/mois ou mois/jour ?
    r"^\d{1,2}-\d{1,2}-\d{2,4}$",
]
CURRENCY_PATTERN = r"^[\d\s.,]+[€$£]?$|^[€$£][\d\s.,]+$"
LEADING_ZERO_CODE_PATTERN = r"^0\d+$"  # "01", "002" -> probablement un code, pas un nombre


@dataclass
class ColumnAnalysis:
    name: str
    detected_type: str          # "numeric" | "date" | "categorical" | "text" | "identifier" | "unknown"
    confidence: float           # 0.0 - 1.0
    sample_values: list = field(default_factory=list)
    needs_clarification: bool = False
    clarification_reason: str | None = None
    missing_count: int = 0
    missing_pct: float = 0.0
    unique_count: int = 0


CONFIDENCE_THRESHOLD = 0.7


def _sample(series: pd.Series, n: int = 5) -> list:
    return series.dropna().astype(str).unique()[:n].tolist()


def analyze_column(series: pd.Series) -> ColumnAnalysis:
    name = series.name
    non_null = series.dropna()
    missing_count = int(series.isna().sum())
    missing_pct = round(missing_count / len(series) * 100, 2) if len(series) else 0.0
    unique_count = int(non_null.nunique())
    sample = _sample(series)

    col = ColumnAnalysis(
        name=name,
        detected_type="unknown",
        confidence=0.0,
        sample_values=sample,
        missing_count=missing_count,
        missing_pct=missing_pct,
        unique_count=unique_count,
    )

    if non_null.empty:
        col.detected_type = "unknown"
        col.confidence = 0.0
        col.needs_clarification = True
        col.clarification_reason = "Colonne entièrement vide."
        return col

    str_values = non_null.astype(str).str.strip()

    # 1. Nombre déjà typé par pandas (int/float natif)
    if pd.api.types.is_numeric_dtype(series):
        # cas des codes à zéro non significatif détectés malgré tout comme numériques
        if str_values.str.match(LEADING_ZERO_CODE_PATTERN).any():
            col.detected_type = "numeric"
            col.confidence = 0.4
            col.needs_clarification = True
            col.clarification_reason = (
                "Certaines valeurs ressemblent à des codes (zéros en tête) : "
                "s'agit-il d'un identifiant/texte ou d'un nombre réel ?"
            )
        else:
            col.detected_type = "numeric"
            col.confidence = 0.95
        return col

    # 2. Dates non ambiguës
    if str_values.str.match("|".join(DATE_PATTERNS)).mean() > 0.9:
        col.detected_type = "date"
        col.confidence = 0.9
        return col

    # 3. Dates ambiguës (format court, jour/mois inversable)
    if str_values.str.match("|".join(AMBIGUOUS_DATE_PATTERNS)).mean() > 0.6:
        col.detected_type = "date"
        col.confidence = 0.5
        col.needs_clarification = True
        col.clarification_reason = (
            "Format de date ambigu (ex. 03/04/2024) : le format est-il JJ/MM/AAAA "
            "ou MM/JJ/AAAA ?"
        )
        return col

    # 4. Codes numériques avec zéro non significatif (colonne texte, ex. "01","02")
    if str_values.str.match(LEADING_ZERO_CODE_PATTERN).mean() > 0.6:
        col.detected_type = "identifier"
        col.confidence = 0.5
        col.needs_clarification = True
        col.clarification_reason = (
            "Valeurs de type '01', '02'... : s'agit-il d'un identifiant/code "
            "(texte) ou d'un nombre ?"
        )
        return col

    # 5. Montants avec symboles monétaires / séparateurs
    if str_values.str.match(CURRENCY_PATTERN).mean() > 0.6:
        col.detected_type = "numeric"
        col.confidence = 0.55
        col.needs_clarification = True
        col.clarification_reason = (
            "Valeurs ressemblant à des montants (symboles/séparateurs) : "
            "confirmer qu'il s'agit bien d'une colonne numérique à nettoyer."
        )
        return col

    # 6. Faible cardinalité -> catégorielle probable
    ratio_unique = unique_count / len(non_null)
    if unique_count <= 20 and ratio_unique < 0.5:
        col.detected_type = "categorical"
        col.confidence = 0.8
        return col

    # 7. Cardinalité très élevée -> texte libre ou identifiant
    if ratio_unique > 0.9:
        col.detected_type = "identifier" if unique_count == len(non_null) else "text"
        col.confidence = 0.45
        col.needs_clarification = True
        col.clarification_reason = (
            "Beaucoup de valeurs uniques : est-ce un identifiant (à exclure des "
            "statistiques) ou du texte libre à conserver ?"
        )
        return col

    # 8. Par défaut : texte
    col.detected_type = "text"
    col.confidence = 0.6
    return col


def analyze_dataframe(df: pd.DataFrame) -> list[ColumnAnalysis]:
    return [analyze_column(df[c]) for c in df.columns]


def needs_any_clarification(columns: list[ColumnAnalysis]) -> bool:
    return any(c.confidence < CONFIDENCE_THRESHOLD for c in columns)
