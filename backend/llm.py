"""Couche IA partagée : un seul point d'entrée pour tous les fournisseurs.

Utilisée par l'onglet Chat, puis par RAG et fine-tuning.
Dépendance unique : httpx (pip install httpx).
"""
import os

import httpx

# Fournisseurs compatibles avec le format OpenAI : même code pour tous.
PROVIDERS = {
    "openai": {
        "type": "openai",
        "url": "https://api.openai.com/v1/chat/completions",
        "default_model": "gpt-4o-mini",
    },
    "gemini": {
        "type": "openai",
        "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "default_model": "gemini-2.5-flash",
    },
    "mistral": {
        "type": "openai",
        "url": "https://api.mistral.ai/v1/chat/completions",
        "default_model": "mistral-small-latest",
    },
    "groq": {
        "type": "openai",
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "default_model": "llama-3.3-70b-versatile",
    },
    # OpenRouter : une seule connexion pour accéder à de nombreux modèles (GPT, Claude, Gemini…).
    # Les noms de modèles ont la forme "fournisseur/modèle" (voir openrouter.ai/models).
    "openrouter": {
        "type": "openai",
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "default_model": "openai/gpt-4o-mini",
    },
    # Anthropic a son propre format.
    "anthropic": {
        "type": "anthropic",
        "url": "https://api.anthropic.com/v1/messages",
        "default_model": "claude-haiku-5-5",
    },
}

# Mode "clé serveur" : variables d'environnement à définir dans Render.
ENV_KEYS = {
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "mistral": "MISTRAL_API_KEY",
    "groq": "GROQ_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}

# Modèles autorisés en mode "clé serveur" (évite qu'un visiteur choisisse un modèle coûteux).
# À ajuster selon les noms en vigueur chez chaque fournisseur.
ALLOWED_MODELS = {
    "openai": ["gpt-4o-mini"],
    "gemini": ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
    "mistral": ["mistral-small-latest"],
    "groq": ["llama-3.3-70b-versatile"],
    "anthropic": ["claude-haiku-5-5"],
}


def server_key(provider: str) -> str | None:
    """Clé stockée dans les variables d'environnement, ou None si absente."""
    return os.getenv(ENV_KEYS.get(provider, "")) or None


async def ask(
    provider: str,
    model: str,
    messages: list[dict],
    api_key: str,
    temperature: float = 0.7,
    max_tokens: int = 1000,
) -> str:
    """Envoie la conversation au fournisseur choisi et renvoie le texte de la réponse."""
    cfg = PROVIDERS.get(provider)
    if cfg is None:
        raise ValueError(f"Fournisseur inconnu : {provider}")

    async with httpx.AsyncClient(timeout=60) as client:
        if cfg["type"] == "openai":
            r = await client.post(
                cfg["url"],
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

        # Format Anthropic : le message "system" est un champ à part.
        system = "\n".join(m["content"] for m in messages if m["role"] == "system")
        body = {
            "model": model,
            "messages": [m for m in messages if m["role"] != "system"],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if system:
            body["system"] = system
        r = await client.post(
            cfg["url"],
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
            json=body,
        )
        r.raise_for_status()
        return "".join(b["text"] for b in r.json()["content"] if b["type"] == "text")
