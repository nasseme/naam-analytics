"""
API V1 — Data Analyst Platform
Endpoints :
  POST /analyze          -> upload d'un CSV/Excel, retourne soit le rapport complet
                             (sauvegardé dans Supabase), soit une liste de clarifications.
  POST /analyze/confirm  -> reçoit les types confirmés par l'utilisateur, sauvegarde et
                             renvoie le rapport final.
  GET  /reports/{id}     -> récupère un rapport déjà sauvegardé, via son lien unique.
"""
from __future__ import annotations

import io
import os
import uuid
from typing import Any

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import Client, create_client

from .type_detection import CONFIDENCE_THRESHOLD, analyze_dataframe

app = FastAPI(title="Data Analyst Platform API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # à restreindre en prod
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE_MB = 10

# --- Supabase ---------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def save_report(filename: str, report: dict[str, Any], file_size: int | None) -> str:
    """Sauvegarde le rapport dans Supabase et retourne son id. Si Supabase n'est
    pas configuré (variables d'env absentes), fonctionne quand même en mode
    dégradé : génère un id local, sans persistance réelle (utile en dev)."""
    report_id = str(uuid.uuid4())
    if supabase is None:
        return report_id

    result = (
        supabase.table("reports")
        .insert(
            {
                "filename": filename,
                "report_json": report,
                "file_size": file_size,
            }
        )
        .execute()
    )
    return result.data[0]["id"]


# --- Uploads en attente de clarification (en mémoire, éphémère) -------------
_pending_uploads: dict[str, dict[str, Any]] = {}


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
    size_bytes = len(content)
    size_mb = size_bytes / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Fichier trop volumineux ({size_mb:.1f} Mo). Limite : {MAX_FILE_SIZE_MB} Mo.",
        )

    filename = file.filename or "fichier"
    df = _read_file(file, content)
    columns = analyze_dataframe(df)

    ambiguous = [c for c in columns if c.confidence < CONFIDENCE_THRESHOLD]

    if ambiguous:
        upload_id = str(uuid.uuid4())
        _pending_uploads[upload_id] = {
            "df": df,
            "filename": filename,
            "size_bytes": size_bytes,
        }
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
    report = _build_report(df, columns_meta)
    report_id = save_report(filename, report, size_bytes)
    return {"status": "complete", "id": report_id, "report": report}


@app.post("/analyze/confirm")
async def confirm(payload: ConfirmRequest):
    pending = _pending_uploads.get(payload.upload_id)
    if pending is None:
        raise HTTPException(status_code=404, detail="Upload introuvable ou expiré.")

    df = pending["df"]
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
    report = _build_report(df, columns_meta)
    report_id = save_report(pending["filename"], report, pending["size_bytes"])
    return {"status": "complete", "id": report_id, "report": report}


@app.get("/reports/{report_id}")
async def get_report(report_id: str):
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase n'est pas configuré sur ce serveur (SUPABASE_URL/SUPABASE_KEY manquants).",
        )
    result = supabase.table("reports").select("*").eq("id", report_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Rapport introuvable.")
    row = result.data[0]
    return {"id": row["id"], "filename": row["filename"], "report": row["report_json"]}


@app.get("/health")
async def health():
    return {"status": "ok", "supabase_connected": supabase is not None}