"use client";

import { useRef, useState } from "react";
import type { Project, Tag } from "@pulse/api-client";
import type { DetectedToken, DetectionType } from "@/lib/quick-add-parser";

const tokenClass: Record<DetectionType, string> = {
  date: "bg-blue-600 text-white",
  time: "bg-violet-600 text-white",
  project: "bg-indigo-600 text-white",
  label: "bg-emerald-600 text-white",
  priority: "bg-amber-600 text-white",
  recurrence: "bg-cyan-600 text-white",
  location: "bg-fuchsia-600 text-white",
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  tokens: DetectedToken[];
  ignoredTokenIds: Set<string>;
  onIgnoreToken: (id: string) => void;
  placeholder?: string;
  tags?: Tag[];
  projects?: Project[];
  compact?: boolean;
}

function mentionQueryAt(value: string, caret: number) {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  const hash = before.lastIndexOf("#");
  const start = Math.max(at, hash);
  if (start < 0 || (start > 0 && !/\s/.test(before[start - 1]!))) return null;
  const marker = before[start];
  const query = before.slice(start + 1);
  if (/[\n@#^*]/.test(query)) return null;
  return { start, end: caret, query: query.toLowerCase(), kind: marker === "@" ? "label" as const : "project" as const };
}

export function SmartTaskInput({ value, onChange, tokens, ignoredTokenIds, onIgnoreToken, placeholder, tags = [], projects = [], compact = false }: Props) {
  const sorted = [...tokens].sort((a, b) => a.start - b.start);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(value.length);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = mentionQueryAt(value, caret);
  const exactAtCaret = query ? sorted.some((token) => token.type === query.kind && token.end === caret && !ignoredTokenIds.has(token.id)) : false;
  const suggestions = !query || exactAtCaret ? [] : (query.kind === "label" ? tags : projects)
    .filter((item) => item.name.toLowerCase().includes(query.query))
    .slice(0, 8)
    .map((item) => ({ kind: query.kind, item }));
  const selectedIndex = suggestions.length ? Math.min(activeIndex, suggestions.length - 1) : 0;

  const selectSuggestion = (suggestion: { kind: "label" | "project"; item: Tag | Project }) => {
    if (!query) return;
    const marker = suggestion.kind === "label" ? "@" : "#";
    const next = `${value.slice(0, query.start)}${marker}${suggestion.item.name} ${value.slice(query.end)}`;
    const nextCaret = query.start + suggestion.item.name.length + 2;
    onChange(next);
    setCaret(nextCaret);
    setActiveIndex(0);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) {
      if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => (index + 1) % suggestions.length); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length); return; }
      if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); selectSuggestion(suggestions[selectedIndex]!); return; }
      if (event.key === "Escape") { setCaret(-1); setActiveIndex(0); return; }
    }
    if (event.key !== "Backspace") return;
    const position = event.currentTarget.selectionStart;
    if (position !== event.currentTarget.selectionEnd) return;
    const token = [...sorted].reverse().find((item) => !ignoredTokenIds.has(item.id) && position >= item.end && position - item.end <= 1 && /^\s*$/.test(value.slice(item.end, position)));
    if (token) { event.preventDefault(); onIgnoreToken(token.id); }
  };

  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  for (const token of sorted) {
    if (token.start < cursor) continue;
    pieces.push(value.slice(cursor, token.start));
    const label = token.type === "label" ? tags.find((item) => item.name.toLowerCase() === token.label.toLowerCase()) : undefined;
    pieces.push(ignoredTokenIds.has(token.id)
      ? <span key={token.id}>{value.slice(token.start, token.end)}</span>
      : <mark key={token.id} style={label?.color ? { backgroundColor: label.color } : undefined} className={`rounded px-1 py-[2px] font-semibold text-white box-decoration-clone ${label?.color ? "" : tokenClass[token.type]}`}>{value.slice(token.start, token.end)}</mark>);
    cursor = token.end;
  }
  pieces.push(value.slice(cursor));

  return (
    <div className="relative">
      <div className={`relative rounded-lg border border-stroke bg-surface transition focus-within:border-primary/55 ${compact ? "min-h-[50px]" : "min-h-[72px]"}`}>
        <div aria-hidden className={`pointer-events-none absolute inset-0 whitespace-pre-wrap break-words text-[15px] font-medium leading-6 text-ink ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}>{pieces}</div>
        <textarea
          ref={ref}
          aria-label="Smart task"
          value={value}
          onChange={(event) => { onChange(event.target.value); setCaret(event.target.selectionStart); setActiveIndex(0); }}
          onClick={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyUp={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          rows={compact ? 1 : 2}
          placeholder={placeholder}
          className={`relative z-10 w-full resize-none bg-transparent text-[15px] font-medium leading-6 text-transparent caret-ink outline-none placeholder:text-muted-soft selection:bg-primary/20 ${compact ? "min-h-[48px] px-3 py-2.5" : "px-4 py-3"}`}
        />
      </div>
      {suggestions.length ? (
        <div role="listbox" aria-label={query?.kind === "project" ? "Project suggestions" : "Label suggestions"} className="absolute left-2 top-full z-[120] mt-1 w-[300px] overflow-hidden rounded-lg border border-stroke bg-surface p-1 shadow-float">
          {suggestions.map((suggestion, index) => (
            <button key={`${suggestion.kind}-${suggestion.item.id}`} type="button" role="option" aria-selected={index === selectedIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => selectSuggestion(suggestion)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${index === selectedIndex ? "bg-surface-subtle text-ink" : "text-muted hover:bg-surface-subtle hover:text-ink"}`}>
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: suggestion.item.color ?? (suggestion.kind === "label" ? "#64748b" : "#dc4c3e") }} />
              <span className="truncate">{suggestion.kind === "label" ? "@" : "#"}{suggestion.item.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
