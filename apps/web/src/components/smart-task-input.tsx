"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Project, Tag } from "@pulse/api-client";
import type { DetectedToken, DetectionType } from "@/lib/quick-add-parser";

const tokenClass: Record<DetectionType, string> = {
  date: "bg-blue-500/20",
  time: "bg-violet-500/20",
  project: "bg-indigo-500/20",
  label: "bg-emerald-500/20",
  priority: "bg-amber-500/20",
  recurrence: "bg-cyan-500/20",
  location: "bg-fuchsia-500/20",
};

function translucentColor(color: string) {
  const hex = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!hex) return `color-mix(in srgb, ${color} 22%, transparent)`;
  return `rgba(${Number.parseInt(hex[1]!, 16)}, ${Number.parseInt(hex[2]!, 16)}, ${Number.parseInt(hex[3]!, 16)}, 0.22)`;
}

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
  autoFocus?: boolean;
}

function mentionQueryAt(value: string, caret: number) {
  if (caret < 0) return null;
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

function editableText(element: HTMLElement) {
  // Browsers use div/br nodes while editing. innerText normalizes those to the
  // same newline representation that the parser and selection offsets use.
  return element.innerText.replace(/\r\n?/g, "\n");
}

function selectionOffset(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.anchorNode || !root.contains(selection.anchorNode)) return null;
  const prefix = selection.getRangeAt(0).cloneRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(selection.anchorNode, selection.anchorOffset);
  return prefix.toString().length;
}

function restoreSelection(root: HTMLElement, requestedOffset: number) {
  const offset = Math.max(0, Math.min(requestedOffset, root.textContent?.length ?? 0));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }

  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function insertPlainText(root: HTMLElement, text: string) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return false;
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

export function SmartTaskInput({ value, onChange, tokens, ignoredTokenIds, onIgnoreToken, placeholder, tags = [], projects = [], compact = false, autoFocus = false }: Props) {
  const sorted = useMemo(() => [...tokens]
    .filter((token) => token.start >= 0 && token.end > token.start && token.end <= value.length)
    .sort((a, b) => a.start - b.start || a.end - b.end), [tokens, value.length]);
  const ref = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const pendingCaret = useRef<number | null>(autoFocus ? value.length : null);
  const [caret, setCaret] = useState(value.length);
  const [activeIndex, setActiveIndex] = useState(0);

  useLayoutEffect(() => {
    const editor = ref.current;
    if (!editor || composing.current) return;

    const wasFocused = document.activeElement === editor;
    const nextCaret = pendingCaret.current ?? (wasFocused ? selectionOffset(editor) : null);
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const token of sorted) {
      if (token.start < cursor) continue;
      if (token.start > cursor) fragment.append(document.createTextNode(value.slice(cursor, token.start)));
      const tokenText = value.slice(token.start, token.end);
      if (ignoredTokenIds.has(token.id)) {
        fragment.append(document.createTextNode(tokenText));
      } else {
        const mark = document.createElement("mark");
        const label = token.type === "label" ? tags.find((item) => item.name.toLowerCase() === token.label.toLowerCase()) : undefined;
        mark.className = `smart-task-token rounded-[3px] ${label?.color ? "" : tokenClass[token.type]}`;
        if (label?.color) mark.style.backgroundColor = translucentColor(label.color);
        mark.dataset.tokenType = token.type;
        mark.dataset.tokenStart = String(token.start);
        mark.dataset.tokenEnd = String(token.end);
        mark.textContent = tokenText;
        fragment.append(mark);
      }
      cursor = token.end;
    }
    if (cursor < value.length) fragment.append(document.createTextNode(value.slice(cursor)));

    editor.replaceChildren(fragment);
    pendingCaret.current = null;
    if (wasFocused || autoFocus) {
      if (autoFocus && !wasFocused) editor.focus({ preventScroll: true });
      restoreSelection(editor, nextCaret ?? value.length);
    }
  }, [autoFocus, ignoredTokenIds, sorted, tags, value]);

  const query = mentionQueryAt(value, caret);
  const exactAtCaret = query ? sorted.some((token) => token.type === query.kind && token.end === caret && !ignoredTokenIds.has(token.id)) : false;
  const suggestions = !query || exactAtCaret ? [] : (query.kind === "label" ? tags : projects)
    .filter((item) => item.name.toLowerCase().includes(query.query))
    .slice(0, 8)
    .map((item) => ({ kind: query.kind, item }));
  const selectedIndex = suggestions.length ? Math.min(activeIndex, suggestions.length - 1) : 0;

  const syncFromEditor = (editor: HTMLDivElement) => {
    const nextValue = editableText(editor);
    const nextCaret = selectionOffset(editor) ?? nextValue.length;
    pendingCaret.current = nextCaret;
    setCaret(nextCaret);
    setActiveIndex(0);
    onChange(nextValue);
  };

  const selectSuggestion = (suggestion: { kind: "label" | "project"; item: Tag | Project }) => {
    if (!query) return;
    const marker = suggestion.kind === "label" ? "@" : "#";
    const next = `${value.slice(0, query.start)}${marker}${suggestion.item.name} ${value.slice(query.end)}`;
    const nextCaret = query.start + suggestion.item.name.length + 2;
    pendingCaret.current = nextCaret;
    setCaret(nextCaret);
    setActiveIndex(0);
    onChange(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (suggestions.length && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) {
      if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => (index + 1) % suggestions.length); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length); return; }
      if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); selectSuggestion(suggestions[selectedIndex]!); return; }
      if (event.key === "Escape") { event.preventDefault(); setCaret(-1); setActiveIndex(0); return; }
    }
    if (event.key === "Enter" && !composing.current) {
      event.preventDefault();
      if (insertPlainText(event.currentTarget, "\n")) syncFromEditor(event.currentTarget);
      return;
    }
    if (event.key !== "Backspace") return;
    const position = selectionOffset(event.currentTarget);
    const selection = window.getSelection();
    if (position === null || !selection?.isCollapsed) return;
    const token = [...sorted].reverse().find((item) => !ignoredTokenIds.has(item.id) && position >= item.end && position - item.end <= 1 && /^\s*$/.test(value.slice(item.end, position)));
    if (token) { event.preventDefault(); onIgnoreToken(token.id); }
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        data-smart-editor
        data-placeholder={placeholder}
        role="textbox"
        aria-label="Smart task"
        aria-multiline="true"
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck
        onInput={(event) => { if (!composing.current) syncFromEditor(event.currentTarget); }}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={(event) => { composing.current = false; syncFromEditor(event.currentTarget); }}
        onPaste={(event) => {
          event.preventDefault();
          if (insertPlainText(event.currentTarget, event.clipboardData.getData("text/plain"))) syncFromEditor(event.currentTarget);
        }}
        onClick={(event) => setCaret(selectionOffset(event.currentTarget) ?? value.length)}
        onKeyUp={(event) => { if (!composing.current) setCaret(selectionOffset(event.currentTarget) ?? value.length); }}
        onKeyDown={onKeyDown}
        style={{ border: "0", outline: "none", boxShadow: "none" }}
        className={`smart-task-editor block w-full whitespace-pre-wrap break-words border-0 bg-transparent text-ink caret-ink outline-none ring-0 shadow-none selection:bg-primary/20 focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 ${compact ? "min-h-[52px] px-2 pt-3 pb-1 text-2xl font-bold leading-8" : "min-h-[72px] px-4 py-3 text-[15px] font-medium leading-6"}`}
      />
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
