"use client";
import type { DetectedToken, DetectionType } from "@/lib/quick-add-parser";

const tokenClass: Record<DetectionType, string> = {
  date: "rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
  time: "rounded bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
  project: "rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200",
  label: "rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  priority: "rounded bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  recurrence: "rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200",
};
interface Props {
  value: string; onChange: (value: string) => void; tokens: DetectedToken[];
  ignoredTokenIds: Set<string>; onIgnoreToken: (id: string) => void; placeholder?: string;
}
export function SmartTaskInput({ value, onChange, tokens, ignoredTokenIds, onIgnoreToken, placeholder }: Props) {
  const sorted = [...tokens].sort((a, b) => a.start - b.start);
  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Backspace") return;
    const el = event.currentTarget;
    if (el.selectionStart !== el.selectionEnd) return;
    const caret = el.selectionStart;
    const token = [...sorted].reverse().find((item) => !ignoredTokenIds.has(item.id) && caret >= item.end && caret - item.end <= 1 && /^\s*$/.test(value.slice(item.end, caret)));
    if (!token) return;
    event.preventDefault(); onIgnoreToken(token.id);
  };  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  for (const token of sorted) {
    if (token.start < cursor) continue;
    pieces.push(value.slice(cursor, token.start));
    pieces.push(ignoredTokenIds.has(token.id)
      ? <span key={token.id}>{value.slice(token.start, token.end)}</span>
      : <mark key={token.id} className={tokenClass[token.type]}>{value.slice(token.start, token.end)}</mark>);
    cursor = token.end;
  }
  pieces.push(value.slice(cursor));
  return (
    <div className="relative min-h-[76px] rounded-xl border border-stroke bg-surface-subtle transition focus-within:border-primary/50 focus-within:bg-surface">
      <div aria-hidden className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-4 py-3 text-[16px] font-medium leading-6 text-ink">{pieces}</div>
      <textarea
        aria-label="Smart task" value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown}
        rows={2} placeholder={placeholder}
        className="relative z-10 w-full resize-none bg-transparent px-4 py-3 text-[16px] font-medium leading-6 text-transparent caret-ink outline-none placeholder:text-muted-soft selection:bg-primary/20"
      />
    </div>
  );
}
