"""
API V1 — Data Analyst Platform
Endpoints :
  POST /analyze          -> upload d'un CSV, retourne soit le rapport complet,
                             soit une liste de clarifications à demander à l'utilisateur.
  POST /analyze/confirm   -> reçoit les types confirmés par l'utilisateur, renvoie le rapport final.

NOTE V1 : pas encore de persistance Supabase ni d'export PDF ici — ce module se concentre
sur le flux upload -> détection -> rapport, à valider avant de brancher le reste.
"""
from __future__ import annotations

import io
import uuid
from typing import Any

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .type_detection import CONFIDENCE_THRESHOLD, analyze_dataframe

app = FastAPI(title="Data Analyst Platform API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # à restreindre en prod
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE_MB = 10

# Stockage en mémoire temporaire des DataFrames en attente de clarification.
# À remplacer par Supabase / cache réel dès que la persistance est branchée.
_pending_uploads: dict[str, pd.DataFrame] = {}


class ClarificationAnswer(BaseModel):
    column: str
    confirmed_type: str  # "numeric" | "date" | "categorical" | "text" | "identifier"


class ConfirmRequest(BaseModel):
    upload_id: str
    answers: list[ClarificationAnswer] = []


def _read_file(file: UploadFile, content: bytes) -> pd.DataFrame:
    filename = (file.filename or "").lower()
    try:
        if filename.endswith(".csv"):
            return pd.read_csv(io.BytesIO(content))
        elif filename.endswith((".xlsx", ".xls")):
            return pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(
                status_code=400,
                detail="Format non supporté. Utilise un fichier .csv ou .xlsx.",
            )
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="Le fichier est vide.")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Impossible de lire le fichier : {exc}")


def _build_report(df: pd.DataFrame, columns_meta: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "preview": df.head(10).fillna("").astype(str).to_dict(orient="records"),
        "duplicates": int(df.duplicated().sum()),
        "columns_analysis": columns_meta,
        "descriptive_stats": df.describe(include="all").fillna("").astype(str).to_dict(),
    }


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Fichier trop volumineux ({size_mb:.1f} Mo). Limite : {MAX_FILE_SIZE_MB} Mo.",
        )

    df = _read_file(file, content)
    columns = analyze_dataframe(df)

    ambiguous = [c for c in columns if c.confidence < CONFIDENCE_THRESHOLD]

    if ambiguous:
        upload_id = str(uuid.uuid4())
        _pending_uploads[upload_id] = df
        return {
            "status": "needs_clarification",
            "upload_id": upload_id,
            "clarifications": [
                {
                    "column": c.name,
                    "detected_type": c.detected_type,
                    "confidence": c.confidence,
                    "reason": c.clarification_reason,
                    "sample_values": c.sample_values,
                }
                for c in ambiguous
            ],
        }

    columns_meta = [c.__dict__ for c in columns]
    return {"status": "complete", "report": _build_report(df, columns_meta)}


@app.post("/analyze/confirm")
async def confirm(payload: ConfirmRequest):
    df = _pending_uploads.get(payload.upload_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Upload introuvable ou expiré.")

    columns = analyze_dataframe(df)
    answers_by_col = {a.column: a.confirmed_type for a in payload.answers}

    columns_meta = []
    for c in columns:
        d = c.__dict__.copy()
        if c.name in answers_by_col:
            d["detected_type"] = answers_by_col[c.name]
            d["confidence"] = 1.0
            d["needs_clarification"] = False
        columns_meta.append(d)

    _pending_uploads.pop(payload.upload_id, None)
    return {"status": "complete", "report": _build_report(df, columns_meta)}


@app.get("/health")
async def health():
    return {"status": "ok"}
