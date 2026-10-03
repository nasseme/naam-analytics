"""
Analyse adaptative : traite chaque colonne selon son type réel, et ne calcule
que ce qui a du sens pour ce type (pas de saisonnalité sans dates, pas de
force explicative sans catégorielle+numérique en présence). Produit une
synthèse courte + des pistes ML justifiées par les résultats observés.
"""
from __future__ import annotations

import pandas as pd

from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.lineplots import LinePlot

MAX_KEY_INSIGHTS = 8
CORRELATION_THRESHOLD = 0.5
ETA_SQUARED_THRESHOLD = 0.14  # seuil conventionnel d'un "effet fort"
SEASONALITY_THRESHOLD = 0.15  # variation relative minimale pour parler de saisonnalité


# ---------- Numérique ----------

def numeric_insights(series: pd.Series) -> dict:
    s = pd.to_numeric(series, errors="coerce").dropna()
    if s.empty:
        return {}

    q1, q3 = s.quantile(0.25), s.quantile(0.75)
    iqr = q3 - q1
    lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    outliers = s[(s < lower) | (s > upper)]

    skew = s.skew()
    if abs(skew) < 0.5:
        shape = "distribution plutôt symétrique"
    elif skew >= 0.5:
        shape = "étalée vers les valeurs hautes (asymétrie positive)"
    else:
        shape = "étalée vers les valeurs basses (asymétrie négative)"

    return {
        "type": "numeric",
        "mean": round(float(s.mean()), 2),
        "median": round(float(s.median()), 2),
        "std": round(float(s.std()), 2),
        "outliers_count": int(len(outliers)),
        "outliers_pct": round(len(outliers) / len(s) * 100, 1),
        "shape": shape,
    }


# ---------- Catégorielle ----------

def categorical_insights(series: pd.Series) -> dict:
    counts = series.dropna().value_counts()
    if counts.empty:
        return {}

    total = counts.sum()
    dominant_pct = counts.iloc[0] / total
    n_classes = int(counts.shape[0])

    return {
        "type": "categorical",
        "top_values": [
            {"value": str(v), "pct": round(c / total * 100, 1)}
            for v, c in counts.head(3).items()
        ],
        "n_classes": n_classes,
        "balance": "déséquilibrée" if dominant_pct > 0.8 else "équilibrée",
        "dominant_pct": round(dominant_pct * 100, 1),
        "is_potential_target": 2 <= n_classes <= 10,
    }


# ---------- Temporelle : tendance + saisonnalité ----------

WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]


def _seasonality(df: pd.DataFrame, group_key: pd.Series, labels: list[str], cycle_name: str) -> dict | None:
    df = df.copy()
    df["_group"] = group_key
    group_means = df.groupby("_group")["value"].mean()
    overall_std = df["value"].std()
    if not overall_std or pd.isna(overall_std) or group_means.shape[0] < 2:
        return None
    variation = float(group_means.std() / overall_std)
    if variation < SEASONALITY_THRESHOLD:
        return None

    averages = [
        {"label": labels[i], "value": round(float(group_means.get(i, 0)), 2)}
        for i in range(len(labels))
        if i in group_means.index
    ]
    best = max(averages, key=lambda a: a["value"])
    worst = min(averages, key=lambda a: a["value"])

    return {
        "cycle": cycle_name,
        "peak": best["label"],
        "low": worst["label"],
        "strength": round(variation, 2),
        "averages": averages,
    }


def time_series_insights(dates: pd.Series, values: pd.Series, column_name: str) -> dict | None:
    df = pd.DataFrame({"date": dates, "value": pd.to_numeric(values, errors="coerce")}).dropna()
    df = df.sort_values("date")
    if len(df) < 6:
        return None

    span_days = (df["date"].max() - df["date"].min()).days

    third = max(len(df) // 3, 1)
    start_mean = df["value"].iloc[:third].mean()
    end_mean = df["value"].iloc[-third:].mean()
    trend, change_pct = "stable", 0.0
    if start_mean != 0:
        change_pct = round((end_mean - start_mean) / abs(start_mean) * 100, 1)
        if change_pct > 5:
            trend = "hausse"
        elif change_pct < -5:
            trend = "baisse"

    seasonality = []
    if span_days >= 14:
        weekly = _seasonality(df, df["date"].dt.dayofweek, WEEKDAY_LABELS, "hebdomadaire")
        if weekly:
            seasonality.append(weekly)
    if span_days >= 180 and df["date"].dt.month.nunique() >= 4:
        monthly = _seasonality(df, df["date"].dt.month - 1, MONTH_LABELS, "mensuelle")
        if monthly:
            seasonality.append(monthly)

    # Série pour le graphique de tendance : on lisse selon l'étendue pour
    # garder un nombre de points raisonnable (pas de courbe illisible).
    rule = "D" if span_days <= 90 else "W" if span_days <= 730 else "M"
    resampled = (
        df.set_index("date")["value"].resample(rule).mean().dropna()
    )
    series = [
        {"date": str(idx.date()), "value": round(float(v), 2)}
        for idx, v in resampled.items()
    ]

    return {
        "column": column_name,
        "trend": trend,
        "change_pct": change_pct,
        "seasonality": seasonality,
        "series": series,
    }


# ---------- Relation catégorielle → numérique (force explicative) ----------

def eta_squared(categories: pd.Series, values: pd.Series) -> float | None:
    """Mesure à quel point une colonne catégorielle explique la variance d'une
    colonne numérique (0 = aucun effet, proche de 1 = effet très fort)."""
    df = pd.DataFrame({"cat": categories, "val": pd.to_numeric(values, errors="coerce")}).dropna()
    if df["cat"].nunique() < 2 or len(df) < 10:
        return None
    grand_mean = df["val"].mean()
    ss_total = ((df["val"] - grand_mean) ** 2).sum()
    if ss_total == 0:
        return None
    ss_between = df.groupby("cat")["val"].apply(lambda g: len(g) * (g.mean() - grand_mean) ** 2).sum()
    return float(ss_between / ss_total)


# ---------- Corrélations numérique ↔ numérique ----------

def compute_correlations(df: pd.DataFrame, numeric_columns: list[str]) -> list[dict]:
    if len(numeric_columns) < 2:
        return []
    numeric_df = df[numeric_columns].apply(pd.to_numeric, errors="coerce")
    corr = numeric_df.corr()
    pairs = []
    for i, col_a in enumerate(numeric_columns):
        for col_b in numeric_columns[i + 1:]:
            r = corr.loc[col_a, col_b]
            if pd.notna(r) and abs(r) >= CORRELATION_THRESHOLD:
                pairs.append({"a": col_a, "b": col_b, "r": round(float(r), 2)})
    pairs.sort(key=lambda p: abs(p["r"]), reverse=True)
    return pairs[:5]


# ---------- Assemblage ----------

def build_curves(df: pd.DataFrame, columns_meta: list[dict], max_points: int = 150) -> dict:
    """Pour chaque colonne numérique : une courbe simple (valeur dans le temps),
    avec la date en abscisse si une colonne date existe, sinon l'ordre des lignes."""
    numeric_cols = [c["name"] for c in columns_meta if c["detected_type"] == "numeric"]
    date_cols = [c["name"] for c in columns_meta if c["detected_type"] == "date"]

    if date_cols:
        x_values = pd.to_datetime(df[date_cols[0]], errors="coerce", dayfirst=True)
        order = x_values.sort_values().index
    else:
        order = df.index
        x_values = pd.Series(range(len(df)), index=df.index)

    curves = {}
    for col in numeric_cols:
        y = pd.to_numeric(df.loc[order, col], errors="coerce")
        x = x_values.loc[order]
        valid = y.notna()
        x, y = x[valid], y[valid]
        if len(y) < 2:
            continue
        if len(y) > max_points:
            step = max(len(y) // max_points, 1)
            x, y = x[::step], y[::step]
        if date_cols:
            points = [{"x": str(xi.date()), "y": round(float(yi), 2)} for xi, yi in zip(x, y)]
        else:
            points = [{"x": int(xi), "y": round(float(yi), 2)} for xi, yi in zip(x, y)]
        curves[col] = points
    return curves

def build_insights(df: pd.DataFrame, columns_meta: list[dict]) -> dict:
    numeric_cols = [c["name"] for c in columns_meta if c["detected_type"] == "numeric"]
    date_cols = [c["name"] for c in columns_meta if c["detected_type"] == "date"]
    categorical_cols = [c["name"] for c in columns_meta if c["detected_type"] == "categorical"]

    per_column: dict[str, dict] = {}
    for c in columns_meta:
        name, t = c["name"], c["detected_type"]
        if t == "numeric":
            per_column[name] = numeric_insights(df[name])
        elif t == "categorical":
            per_column[name] = categorical_insights(df[name])

    # Temporel : uniquement si une colonne date existe
    time_series = []
    if date_cols and numeric_cols:
        parsed_dates = pd.to_datetime(df[date_cols[0]], errors="coerce", dayfirst=True)
        for col in numeric_cols:
            ts = time_series_insights(parsed_dates, df[col], col)
            if ts:
                time_series.append(ts)

    # Force explicative catégorielle → numérique : uniquement si les deux existent
    explanatory_relations = []
    for cat_col in categorical_cols:
        n_classes = df[cat_col].nunique()
        if not (2 <= n_classes <= 10):
            continue
        for num_col in numeric_cols:
            eta2 = eta_squared(df[cat_col], df[num_col])
            if eta2 is not None and eta2 >= ETA_SQUARED_THRESHOLD:
                explanatory_relations.append(
                    {"categorical": cat_col, "numeric": num_col, "eta_squared": round(eta2, 2)}
                )
    explanatory_relations.sort(key=lambda r: r["eta_squared"], reverse=True)
    explanatory_relations = explanatory_relations[:3]

    correlations = compute_correlations(df, numeric_cols)

    # Synthèse lisible
    key_insights: list[str] = []
    ml_suggestions: list[str] = []

    for ts in time_series:
        key_insights.append(
            f"« {ts['column']} » est en {ts['trend']} ({ts['change_pct']:+.1f}%) sur la période."
        )
        for s in ts["seasonality"]:
            key_insights.append(
                f"Saisonnalité {s['cycle']} détectée sur « {ts['column']} » "
                f"(pic : {s['peak']}, creux : {s['low']})."
            )
        ml_suggestions.append(
            f"« {ts['column']} » est une série temporelle : adaptée au forecasting (V2)."
        )

    for rel in explanatory_relations:
        key_insights.append(
            f"« {rel['categorical']} » influence fortement « {rel['numeric']} » "
            f"(η²={rel['eta_squared']})."
        )
        ml_suggestions.append(
            f"« {rel['categorical']} » pourrait être une variable explicative clé pour "
            f"prédire « {rel['numeric']} » (régression ou segmentation, V2)."
        )

    for pair in correlations:
        key_insights.append(f"Lien fort entre « {pair['a']} » et « {pair['b']} » (r={pair['r']}).")
    if correlations:
        ml_suggestions.append("Corrélations fortes détectées : pistes pour une régression (V2).")

    outlier_cols = sorted(
        (
            (name, info["outliers_pct"])
            for name, info in per_column.items()
            if info.get("type") == "numeric" and info.get("outliers_count", 0) > 0
        ),
        key=lambda x: x[1],
        reverse=True,
    )
    for name, pct in outlier_cols[:2]:
        key_insights.append(f"« {name} » contient {pct}% de valeurs potentiellement aberrantes.")
    if outlier_cols:
        ml_suggestions.append("Valeurs aberrantes présentes : détection d'anomalies pertinente (V2).")

    for name, info in per_column.items():
        if info.get("type") == "categorical" and info.get("is_potential_target"):
            n = info["n_classes"]
            ml_suggestions.append(
                f"« {name} » ({n} classes) pourrait être une cible de classification (V2)."
            )

    return {
        "per_column": per_column,
        "time_series": time_series,
        "explanatory_relations": explanatory_relations,
        "correlations": correlations,
        "key_insights": key_insights[:MAX_KEY_INSIGHTS],
        "ml_suggestions": list(dict.fromkeys(ml_suggestions)),  # dédoublonne en gardant l'ordre
    }