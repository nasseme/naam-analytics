"use client";

import { useEffect, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
type ProviderInfo = { default_model: string; models: string[]; server_key: boolean };

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const OR_VERIFIER = "or_code_verifier";

const AI_INFO: Record<string, { name: string; desc: string; signup: string }> = {
  openrouter: { name: "OpenRouter", desc: "Un seul compte, de nombreux modèles", signup: "https://openrouter.ai" },
  gemini: { name: "Gemini", desc: "Google, offre gratuite", signup: "https://aistudio.google.com/apikey" },
  groq: { name: "Groq", desc: "Modèles ouverts, très rapide", signup: "https://console.groq.com" },
  mistral: { name: "Mistral", desc: "IA européenne", signup: "https://console.mistral.ai" },
  openai: { name: "OpenAI", desc: "Modèles GPT", signup: "https://platform.openai.com/api-keys" },
  anthropic: { name: "Claude", desc: "Modèles d'Anthropic", signup: "https://console.anthropic.com" },
};

function base64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Redirige vers la page de connexion OpenRouter (OAuth PKCE : ton site ne voit jamais le mot de passe)
async function startOpenRouterLogin() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)).buffer);
  sessionStorage.setItem(OR_VERIFIER, verifier);
  const challenge = base64url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  );
  const callback = `${window.location.origin}/chat`;
  window.location.href =
    `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callback)}` +
    `&code_challenge=${challenge}&code_challenge_method=S256`;
}

export default function ChatPage() {
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({});
  const [provider, setProvider] = useState("gemini");
  const [mode, setMode] = useState<"server" | "own">("server");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(false);

  const info = providers[provider];
  const serverAvailable = info?.server_key ?? false;

  useEffect(() => {
    fetch(`${API}/chat/providers`)
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => setError("Backend injoignable"));
  }, []);

  // Retour de la connexion OpenRouter : l'URL contient ?code=...
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    const verifier = sessionStorage.getItem(OR_VERIFIER);
    if (!code || !verifier) return;
    window.history.replaceState({}, "", "/chat");
    sessionStorage.removeItem(OR_VERIFIER);
    fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ key }) => {
        sessionStorage.setItem("key:openrouter", key);
        setProvider("openrouter");
        setMode("own");
        setApiKey(key);
        setPicked(true);
      })
      .catch(() => setError("Connexion OpenRouter échouée, réessaie"));
  }, []);

  // Au changement de fournisseur : mode par défaut = clé serveur si disponible, sinon ma clé
  useEffect(() => {
    if (!info) return;
    setMode(info.server_key ? "server" : "own");
    setModel(info.default_model);
    setApiKey(sessionStorage.getItem(`key:${provider}`) ?? "");
  }, [provider, info]);

  function saveKey(value: string) {
    setApiKey(value);
    sessionStorage.setItem(`key:${provider}`, value);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    if (mode === "own" && !apiKey) return setError("Ajoute ta clé API pour ce fournisseur");

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (mode === "own") headers["X-API-Key"] = apiKey; // jamais envoyée en mode serveur
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          provider,
          model: model || null,
          messages: next.slice(-20), // historique limité (coût)
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Erreur");
      setMessages([...next, { role: "assistant", content: data.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  if (!picked) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-1 text-xl font-semibold">Chat IA</h1>
        <p className="mb-4 text-sm text-gray-500">
          Choisis une IA, puis connecte-toi ou crée un compte chez le fournisseur.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.keys(providers).map((p) => {
            const meta = AI_INFO[p] ?? { name: p, desc: "", signup: "" };
            return (
              <div key={p} className="rounded border p-4">
                <div className="font-medium">{meta.name}</div>
                <p className="mb-3 text-sm text-gray-500">{meta.desc}</p>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
                    onClick={() => {
                      setProvider(p);
                      setPicked(true);
                    }}
                  >
                    Utiliser
                  </button>
                  {meta.signup && (
                    <a
                      className="text-sm underline"
                      href={meta.signup}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Créer un compte
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-56px)] max-w-3xl flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Chat IA</h1>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => setPicked(false)}>
          Changer d&apos;IA
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <select
          className="rounded border p-2"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          {Object.keys(providers).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          className="rounded border p-2"
          value={mode}
          onChange={(e) => setMode(e.target.value as "server" | "own")}
        >
          <option value="server" disabled={!serverAvailable}>
            Clé serveur{serverAvailable ? "" : " (indisponible)"}
          </option>
          <option value="own">Ma propre clé</option>
        </select>

        {mode === "server" ? (
          <select
            className="rounded border p-2"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {(info?.models ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="rounded border p-2"
            placeholder={`Modèle (défaut : ${info?.default_model ?? "…"})`}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        )}
      </div>

      {mode === "own" && provider === "openrouter" && (
        <div className="flex items-center gap-3">
          {apiKey ? (
            <>
              <span className="text-sm text-green-700">Connecté à OpenRouter</span>
              <button
                className="rounded border px-3 py-1 text-sm"
                onClick={() => saveKey("")}
              >
                Se déconnecter
              </button>
            </>
          ) : (
            <button
              className="rounded bg-blue-600 px-4 py-2 text-white"
              onClick={startOpenRouterLogin}
            >
              Se connecter avec OpenRouter
            </button>
          )}
        </div>
      )}
      {mode === "own" && provider !== "openrouter" && (
        <div className="space-y-1">
          <input
            className="w-full rounded border p-2"
            type="password"
            autoComplete="off"
            placeholder="Clé API"
            value={apiKey}
            onChange={(e) => saveKey(e.target.value)}
          />
          <p className="text-xs text-gray-500">
            Ta clé reste dans cette session et n&apos;est pas enregistrée sur nos serveurs.
          </p>
        </div>
      )}
      {mode === "server" && (
        <p className="text-xs text-gray-500">
          Usage gratuit limité à 20 messages par heure. Au-delà, utilise ta propre clé.
        </p>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto rounded border p-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">Choisis un fournisseur et pose ta question.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded px-3 py-2 text-left ${
                m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
        {loading && <p className="text-sm text-gray-500">Réponse en cours…</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <textarea
          className="flex-1 rounded border p-2"
          rows={2}
          placeholder="Ton message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          className="rounded bg-blue-600 px-4 text-white disabled:opacity-50"
          onClick={send}
          disabled={loading}
        >
          Envoyer
        </button>
        <button
          className="rounded border px-3"
          onClick={() => setMessages([])}
          disabled={loading}
        >
          Effacer
        </button>
      </div>
    </main>
  );
}
