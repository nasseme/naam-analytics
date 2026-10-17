"""Route /chat avec deux modes :
- "clé serveur" (par défaut) : clés dans les variables d'environnement Render,
  modèles limités, quota par IP ;
- "ma clé" : l'utilisateur fournit sa clé (en-tête X-API-Key), jamais stockée ni loguée.
"""
import logging
import time
from collections import defaultdict, deque
from typing import Literal

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from llm import ALLOWED_MODELS, PROVIDERS, ask, server_key

logger = logging.getLogger("chat")
router = APIRouter(prefix="/chat", tags=["chat"])

# Quota simple en mémoire (mode clé serveur uniquement) : 20 messages / heure / IP.
# Se réinitialise au redémarrage du serveur ; suffisant pour une V1.
QUOTA_MAX, QUOTA_WINDOW = 20, 3600
_hits: dict[str, deque] = defaultdict(deque)


def _check_quota(ip: str) -> None:
    now = time.time()
    q = _hits[ip]
    while q and now - q[0] > QUOTA_WINDOW:
        q.popleft()
    if len(q) >= QUOTA_MAX:
        raise HTTPException(
            429, "Limite atteinte (20 messages/heure). Utilise ta propre clé pour continuer."
        )
    q.append(now)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() or (request.client.host if request.client else "unknown")


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(max_length=8000)


class ChatRequest(BaseModel):
    provider: str
    model: str | None = None  # si vide : modèle par défaut du fournisseur
    messages: list[Message] = Field(min_length=1, max_length=30)


@router.get("/providers")
def list_providers():
    """Fournisseurs, modèle par défaut, modèles autorisés et disponibilité d'une clé serveur."""
    return {
        name: {
            "default_model": cfg["default_model"],
            "models": ALLOWED_MODELS.get(name, [cfg["default_model"]]),
            "server_key": server_key(name) is not None,
        }
        for name, cfg in PROVIDERS.items()
    }


@router.post("")
async def chat(
    req: ChatRequest,
    request: Request,
    x_api_key: str | None = Header(default=None),
):
    if req.provider not in PROVIDERS:
        raise HTTPException(400, "Fournisseur inconnu")

    model = req.model or PROVIDERS[req.provider]["default_model"]

    if x_api_key:  # mode "ma clé" : tout modèle accepté, pas de quota serveur
        if len(x_api_key) < 8:
            raise HTTPException(400, "Clé API invalide")
        api_key, mode = x_api_key, "own"
    else:  # mode "clé serveur"
        api_key = server_key(req.provider)
        if not api_key:
            raise HTTPException(400, "Aucune clé serveur pour ce fournisseur : ajoute la tienne")
        if model not in ALLOWED_MODELS.get(req.provider, []):
            raise HTTPException(400, "Modèle non autorisé en mode clé serveur")
        _check_quota(_client_ip(request))
        mode = "server"

    start = time.time()
    status = 200
    try:
        answer = await ask(
            req.provider, model, [m.model_dump() for m in req.messages], api_key
        )
        return {"answer": answer, "model": model}
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        if status in (401, 403):
            raise HTTPException(401, "Clé API refusée par le fournisseur")
        if status == 429:
            raise HTTPException(429, "Quota ou limite de requêtes atteinte chez le fournisseur")
        if status in (400, 404):
            raise HTTPException(400, "Requête refusée : vérifie le nom du modèle")
        raise HTTPException(502, "Erreur du fournisseur")
    except httpx.RequestError:
        status = 504
        raise HTTPException(504, "Fournisseur injoignable")
    finally:
        # Jamais la clé ni le contenu des messages : uniquement des métadonnées.
        logger.info(
            "chat mode=%s provider=%s model=%s status=%s duration=%.2fs",
            mode, req.provider, model, status, time.time() - start,
        )
