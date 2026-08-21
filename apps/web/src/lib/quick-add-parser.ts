import type { CreateTaskInput, Project, Section, Tag } from "@pulse/api-client";
import type { Priority } from "@pulse/domain";

export interface QuickAddContext {
  projects?: Project[];
  sections?: Section[];
  tags?: Tag[];
  defaultProjectId?: string | null;
  now?: Date;
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6,
};

const PRIORITY: Record<string, Priority> = {
  "1": "urgent", "2": "high", "3": "medium", "4": "low",
};

function localDate(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateFromToken(text: string, now: Date): { date?: string; match?: string } {
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/i);
  if (iso) return { date: iso[1], match: iso[0] };
  const relative = text.match(/\b(today|tomorrow)\b/i);
  if (relative) {
    const value = new Date(now);
    if (relative[1].toLowerCase() === "tomorrow") value.setDate(value.getDate() + 1);
    return { date: localDate(value), match: relative[0] };
  }
  const next = text.match(/\bnext\s+(sun(?:day)?|mon(?:day)?|tue(?:s|sday|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i);
  if (next) {
    const key = next[1].toLowerCase();
    const target = WEEKDAYS[key];
    if (target !== undefined) {
      const value = new Date(now);
      let add = (target - value.getDay() + 7) % 7;
      if (add === 0) add = 7;
      value.setDate(value.getDate() + add);
      return { date: localDate(value), match: next[0] };
    }
  }
  return {};
}

function findByName<T extends { name: string }>(items: T[] | undefined, name: string): T | undefined {
  const needle = name.toLowerCase();
  return items?.find((item) => item.name.toLowerCase() === needle);
}

export function resolveQuickAddProjectId(
  text: string,
  projects: Project[] | undefined,
  defaultProjectId?: string | null,
): string | null | undefined {
  const token = text.match(/(?:^|\s)#([\p{L}\p{N}_-]+)/u);
  const project = token ? findByName(projects, token[1]) : undefined;
  return project?.id ?? defaultProjectId;
}

export function parseQuickAdd(text: string, context: QuickAddContext = {}): CreateTaskInput {
  let title = text.trim();
  const now = context.now ?? new Date();
  const projectToken = title.match(/(?:^|\s)#([\p{L}\p{N}_-]+)/u);
  const project = projectToken ? findByName(context.projects, projectToken[1]) : undefined;
  const projectId = project?.id ?? context.defaultProjectId ?? null;
  if (project && projectToken) title = title.replace(projectToken[0], " ");

  const sectionToken = title.match(/(?:^|\s)@([\p{L}\p{N}_-]+)/u);
  const section = sectionToken ? findByName(context.sections, sectionToken[1]) : undefined;
  if (section && section.projectId === projectId && sectionToken) title = title.replace(sectionToken[0], " ");

  const tagIds: string[] = [];
  title = title.replace(/(?:^|\s)\+([\p{L}\p{N}_-]+)/gu, (full, name: string) => {
    const tag = findByName(context.tags, name);
    if (!tag) return full;
    tagIds.push(tag.id);
    return " ";
  });

  let priority: Priority | undefined;
  title = title.replace(/(?:^|\s)!(?:p)?([1-4])\b/i, (full, level: string) => {
    priority = PRIORITY[level];
    return " ";
  });

  const date = dateFromToken(title, now);
  if (date.match) title = title.replace(date.match, " ");
  const time = title.match(/\bat\s+([01]?\d|2[0-3]):([0-5]\d)\b/i);
  if (time) title = title.replace(time[0], " ");

  const input: CreateTaskInput = {
    title: title.replace(/\s+/g, " ").trim(),
    projectId,
  };
  if (section && section.projectId === projectId) input.sectionId = section.id;
  if (tagIds.length) input.tagIds = [...new Set(tagIds)];
  if (priority) input.priority = priority;

  if (time) {
    const [year, month, day] = (date.date ?? localDate(now)).split("-").map(Number);
    const due = new Date(year, month - 1, day, Number(time[1]), Number(time[2]), 0, 0);
    input.dueAt = due.toISOString();
  } else if (date.date) {
    input.dueDate = date.date;
  }
  return input;
}
