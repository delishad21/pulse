"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Save } from "lucide-react";
import type { NotificationPreferences, UpdateNotificationPreferences } from "@pulse/api-client";
import { apiClient } from "@/lib/api-client";

function Toggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-4 border-b border-stroke py-3 last:border-0"><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{label}</span><span className="mt-0.5 block text-xs leading-5 text-muted">{detail}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-primary" /></label>;
}

export function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void apiClient.getNotificationPreferences().then(setSettings).catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load reminder settings.")); }, []);
  const patch = <K extends keyof UpdateNotificationPreferences>(key: K, value: UpdateNotificationPreferences[K]) => setSettings((current) => current ? { ...current, [key]: value } : current);
  const minuteList = (value: string) => [...new Set(value.split(",").map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item >= 0 && item <= 10080))].slice(0, 8);
  const save = async () => { if (!settings) return; setSaving(true); setSaved(false); try { setSettings(await apiClient.updateNotificationPreferences(settings)); setSaved(true); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "Could not save reminder settings."); } finally { setSaving(false); } };
  if (!settings) return <div className="p-5 text-sm text-muted">{error ?? "Loading reminder settings…"}</div>;
  return <div className="p-5">
    <div className="mb-4 flex items-start gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary"><Bell className="size-5" /></div><div><h2 className="font-semibold text-ink">Reminder delivery</h2><p className="mt-0.5 text-sm text-muted">Send through Hermes with an independent Telegram fallback.</p></div></div>
    <Toggle label="Enable reminders" detail="The Pulse worker will deliver reminders when they become due." checked={settings.enabled} onChange={(v) => patch("enabled", v)} />
    <Toggle label="Hermes primary" detail={`Preferred delivery through the Hermes bot${settings.hermesConfigured ? " · configured" : " · server setup required"}.`} checked={settings.hermesEnabled} onChange={(v) => patch("hermesEnabled", v)} />
    <Toggle label="Direct Telegram fallback" detail={`Use a separate bot if Hermes fails${settings.fallbackConfigured ? " · configured" : " · bot token required"}.`} checked={settings.fallbackEnabled} onChange={(v) => patch("fallbackEnabled", v)} />
    <Toggle label="Email" detail={`Send an additional email reminder${settings.emailConfigured ? " · configured" : " · SMTP setup required"}.`} checked={settings.emailEnabled} onChange={(v) => patch("emailEnabled", v)} />
    {settings.emailEnabled ? <label className="block border-b border-stroke py-3 text-xs font-semibold text-muted">Reminder email<input type="email" value={settings.emailAddress ?? ""} onChange={(e) => patch("emailAddress", e.target.value || null)} placeholder="Use account email" className="mt-1 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink" /></label> : null}
    <Toggle label="Phone notifications" detail={`${settings.registeredPushDevices} registered phone${settings.registeredPushDevices === 1 ? "" : "s"}. Register a phone from the Pulse app.`} checked={settings.pushEnabled} onChange={(v) => patch("pushEnabled", v)} />
    <div className="grid gap-4 border-b border-stroke py-4 sm:grid-cols-3">
      <label className="text-xs font-semibold text-muted">Fallback timeout<input type="number" min={3} max={120} value={settings.fallbackAfterSeconds} onChange={(e) => patch("fallbackAfterSeconds", Number(e.target.value))} className="mt-1 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink" /></label>
      <label className="text-xs font-semibold text-muted">Message style<select value={settings.deliveryStyle} onChange={(e) => patch("deliveryStyle", e.target.value as "compact" | "detailed")} className="mt-1 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink"><option value="detailed">Detailed</option><option value="compact">Compact</option></select></label>
      <label className="text-xs font-semibold text-muted">Quiet-hour behavior<select value={settings.quietMode} onChange={(e) => patch("quietMode", e.target.value as NotificationPreferences["quietMode"])} className="mt-1 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink"><option value="delay">Delay</option><option value="silent">Send silently</option><option value="send">Send normally</option></select></label>
    </div>
    <Toggle label="Quiet hours" detail="Apply your selected quiet-hour behavior during this window." checked={settings.quietHoursEnabled} onChange={(v) => patch("quietHoursEnabled", v)} />
    {settings.quietHoursEnabled ? <div className="grid grid-cols-2 gap-3 border-b border-stroke py-3"><label className="text-xs font-semibold text-muted">Starts<input type="time" value={settings.quietStart} onChange={(e) => patch("quietStart", e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink" /></label><label className="text-xs font-semibold text-muted">Ends<input type="time" value={settings.quietEnd} onChange={(e) => patch("quietEnd", e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink" /></label></div> : null}
    <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Detailed messages</p>
    <Toggle label="Description" detail="Include the task description." checked={settings.includeDescription} onChange={(v) => patch("includeDescription", v)} />
    <Toggle label="Project" detail="Include the project name." checked={settings.includeProject} onChange={(v) => patch("includeProject", v)} />
    <Toggle label="Due date" detail="Include the task deadline." checked={settings.includeDue} onChange={(v) => patch("includeDue", v)} />
    <Toggle label="Priority" detail="Include priority when set." checked={settings.includePriority} onChange={(v) => patch("includePriority", v)} />
    <div className="grid gap-4 border-b border-stroke py-4 sm:grid-cols-2">
      <label className="text-xs font-semibold text-muted">Default lead-time presets (minutes)<input value={settings.defaultLeadMinutes.join(", ")} onChange={(e) => patch("defaultLeadMinutes", minuteList(e.target.value))} className="mt-1 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink" /></label>
      <label className="text-xs font-semibold text-muted">Snooze presets (minutes)<input value={settings.snoozeMinutes.join(", ")} onChange={(e) => patch("snoozeMinutes", minuteList(e.target.value))} className="mt-1 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink" /></label>
      <label className="text-xs font-semibold text-muted">Telegram chat override<input value={settings.telegramChatId ?? ""} onChange={(e) => patch("telegramChatId", e.target.value || null)} placeholder="Use server default" className="mt-1 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink" /></label>
      <label className="text-xs font-semibold text-muted">Telegram topic override<input value={settings.telegramThreadId ?? ""} onChange={(e) => patch("telegramThreadId", e.target.value || null)} placeholder="Use server default" className="mt-1 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink" /></label>
    </div>
    <div className="mt-4 flex items-center gap-3"><button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"><Save className="size-4" />{saving ? "Saving…" : "Save reminder settings"}</button>{saved ? <span className="inline-flex items-center gap-1 text-sm text-green-700"><CheckCircle2 className="size-4" />Saved</span> : null}</div>
    {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
  </div>;
}
