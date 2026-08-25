"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Plus, Trash2, X } from "lucide-react";
import type { ApiKeySummary, CreatedApiKey } from "@pulse/api-client";
import { apiClient } from "@/lib/api-client";

function formatTimestamp(value: string | null): string {
  if (!value) return "Never used";
  return `Last used ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))}`;
}

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [name, setName] = useState("Hermes");
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiClient.listApiKeys()
      .then((items) => { if (active) { setKeys(items); setError(null); } })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load API keys."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSubmitting(true);
    try {
      const key = await apiClient.createApiKey(trimmedName);
      setCreated(key);
      setKeys((current) => [key, ...current]);
      setCopied(false);
      setError(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create the API key.");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.token);
    setCopied(true);
  };

  const revoke = async (key: ApiKeySummary) => {
    if (!window.confirm(`Revoke the API key “${key.name}”? Any MCP using it will stop working immediately.`)) return;
    try {
      await apiClient.revokeApiKey(key.id);
      setKeys((current) => current.filter((item) => item.id !== key.id));
      setError(null);
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Could not revoke the API key.");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><KeyRound className="size-5" /></div>
        <div>
          <h2 className="font-semibold text-ink">API keys</h2>
          <p className="mt-0.5 text-sm text-muted">Create a personal key for Pulse MCP integrations such as Hermes.</p>
        </div>
      </div>

      <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">API key name</span>
          <input aria-label="API key name" value={name} onChange={(event) => setName(event.target.value.slice(0, 80))} placeholder="Hermes" className="h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink outline-none focus:border-primary" />
        </label>
        <button type="submit" disabled={!name.trim() || submitting} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40"><Plus className="size-4" />{submitting ? "Creating…" : "Create key"}</button>
      </form>

      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-4 divide-y divide-stroke border-t border-stroke">
        {keys.map((key) => (
          <div key={key.id} className="group flex min-h-14 items-center gap-3 py-2.5">
            <KeyRound className="size-4 shrink-0 text-muted" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{key.name}</p><p className="truncate font-mono text-xs text-muted">{key.tokenPrefix}… · {formatTimestamp(key.lastUsedAt)}</p></div>
            <button type="button" onClick={() => void revoke(key)} aria-label={`Revoke API key ${key.name}`} className="flex size-8 items-center justify-center rounded-md text-muted opacity-70 transition hover:bg-red-50 hover:text-danger group-hover:opacity-100"><Trash2 className="size-4" /></button>
          </div>
        ))}
        {!loading && keys.length === 0 ? <p className="py-4 text-sm text-muted">No API keys yet.</p> : null}
        {loading ? <p className="py-4 text-sm text-muted">Loading API keys…</p> : null}
      </div>

      {created ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreated(null); }}>
          <div role="dialog" aria-modal="true" aria-label="API key created" className="w-full max-w-[600px] rounded-xl border border-stroke bg-surface shadow-float">
            <div className="flex items-center justify-between border-b border-stroke px-4 py-3"><h3 className="text-base font-bold text-ink">API key created</h3><button type="button" onClick={() => setCreated(null)} aria-label="Close API key" className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-subtle"><X className="size-4" /></button></div>
            <div className="space-y-3 p-4">
              <p className="text-sm text-muted">Copy this key now. Pulse stores only its hash, so it cannot be shown again.</p>
              <div className="flex items-center gap-2 rounded-lg border border-stroke bg-surface-subtle p-2">
                <input aria-label="Generated API key" readOnly value={created.token} className="min-w-0 flex-1 bg-transparent px-1 font-mono text-xs text-ink outline-none" />
                <button type="button" onClick={() => void copy()} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-white">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copied" : "Copy"}</button>
              </div>
              <p className="text-xs text-muted">Store it as <code className="font-mono">PULSE_MCP_API_KEY</code> in the Pulse deployment environment, then restart the Hermes MCP connection.</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
