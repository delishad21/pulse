import type { CreateTaskInput, Project, Section, Tag } from "@pulse/api-client";
import { generateRecurrenceRule, type Priority, type Weekday } from "@pulse/domain";

export interface QuickAddContext {
  projects?: Project[];
  sections?: Section[];
  tags?: Tag[];
  defaultProjectId?: string | null;
  now?: Date;
}

const WEEKDAYS: Record<string, { day: number; rrule: Weekday }> = {
  sun: { day: 0, rrule: "SU" }, sunday: { day: 0, rrule: "SU" },
  mon: { day: 1, rrule: "MO" }, monday: { day: 1, rrule: "MO" },
  tue: { day: 2, rrule: "TU" }, tues: { day: 2, rrule: "TU" }, tuesday: { day: 2, rrule: "TU" },
  wed: { day: 3, rrule: "WE" }, wednesday: { day: 3, rrule: "WE" },
  thu: { day: 4, rrule: "TH" }, thur: { day: 4, rrule: "TH" }, thurs: { day: 4, rrule: "TH" }, thursday: { day: 4, rrule: "TH" },
  fri: { day: 5, rrule: "FR" }, friday: { day: 5, rrule: "FR" },
  sat: { day: 6, rrule: "SA" }, saturday: { day: 6, rrule: "SA" },
};
const WEEKDAY_WORD = "sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?";
const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const MONTH_WORD = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const PRIORITY: Record<string, Priority> = { "1": "urgent", "2": "high", "3": "medium", "4": "low" };

function localDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function validLocalDate(year: number, month: number, day: number): Date | null {
  const value = new Date(year, month, day);
  return value.getFullYear() === year && value.getMonth() === month && value.getDate() === day ? value : null;
}

function nextWeekday(now: Date, target: number, forceNext: boolean): Date {
  const value = new Date(now);
  value.setHours(0, 0, 0, 0);
  let add = (target - value.getDay() + 7) % 7;
  if (forceNext && add === 0) add = 7;
  value.setDate(value.getDate() + add);
  return value;
}

function findRecurrence(text: string): { rule?: string; match?: string; weekday?: number } {
  const weekday = text.match(new RegExp(`\\bevery\\s+(${WEEKDAY_WORD})\\b`, "i"));
  if (weekday) {
    const info = WEEKDAYS[weekday[1].toLowerCase()];
    if (info) return { rule: generateRecurrenceRule({ frequency: "weekly", byWeekday: [info.rrule] }), match: weekday[0], weekday: info.day };
  }
  const weekdays = text.match(/\bevery\s+weekdays?\b/i);
  if (weekdays) return { rule: generateRecurrenceRule({ frequency: "weekly", byWeekday: ["MO", "TU", "WE", "TH", "FR"] }), match: weekdays[0] };
  const simple = text.match(/\bevery\s+(day|daily|week|weekly|month|monthly|year|yearly)\b/i);
  if (!simple) return {};
  const token = simple[1].toLowerCase();
  const frequency = token.startsWith("day") ? "daily" : token.startsWith("week") ? "weekly" : token.startsWith("month") ? "monthly" : "yearly";
  return { rule: generateRecurrenceRule({ frequency }), match: simple[0] };
}

function findDate(text: string, now: Date, recurringWeekday?: number): { date?: string; match?: string } {
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return { date: iso[1], match: iso[0] };

  const relative = text.match(/\b(today|tomorrow)\b/i);
  if (relative) {
    const value = new Date(now);
    value.setHours(0, 0, 0, 0);
    if (relative[1].toLowerCase() === "tomorrow") value.setDate(value.getDate() + 1);
    return { date: localDate(value), match: relative[0] };
  }

  const next = text.match(new RegExp(`\\bnext\\s+(${WEEKDAY_WORD})\\b`, "i"));
  if (next) {
    const info = WEEKDAYS[next[1].toLowerCase()];
    if (info) return { date: localDate(nextWeekday(now, info.day, true)), match: next[0] };
  }

  const weekday = text.match(new RegExp(`\\b(${WEEKDAY_WORD})\\b`, "i"));
  if (weekday) {
    const info = WEEKDAYS[weekday[1].toLowerCase()];
    if (info) return { date: localDate(nextWeekday(now, info.day, false)), match: weekday[0] };
  }

  if (recurringWeekday !== undefined) return { date: localDate(nextWeekday(now, recurringWeekday, false)) };

  const monthFirst = text.match(new RegExp(`\\b(${MONTH_WORD})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i"));
  const dayFirst = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_WORD})(?:\\s+(\\d{4}))?\\b`, "i"));
  const named = monthFirst ?? dayFirst;
  if (named) {
    const monthName = (monthFirst ? named[1] : named[2]).toLowerCase();
    const day = Number(monthFirst ? named[2] : named[1]);
    let year = Number(named[3] || now.getFullYear());
    const month = MONTHS[monthName];
    let value = validLocalDate(year, month, day);
    if (value && !named[3] && value.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
      year += 1;
      value = validLocalDate(year, month, day);
    }
    if (value) return { date: localDate(value), match: named[0] };
  }

  const numeric = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2}|\d{4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    let year = numeric[3] ? Number(numeric[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    let value = validLocalDate(year, month, day);
    if (value && !numeric[3] && value.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
      value = validLocalDate(year + 1, month, day);
    }
    if (value) return { date: localDate(value), match: numeric[0] };
  }
  return {};
}

function findTime(text: string): { hour?: number; minute?: number; match?: string } {
  const twelve = text.match(/\b(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (twelve) {
    let hour = Number(twelve[1]) % 12;
    if (twelve[3].toLowerCase() === "pm") hour += 12;
    return { hour, minute: Number(twelve[2] ?? 0), match: twelve[0] };
  }
  const twentyFour = text.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i);
  if (twentyFour) return { hour: Number(twentyFour[1]), minute: Number(twentyFour[2]), match: twentyFour[0] };
  return {};
}

function findByName<T extends { name: string }>(items: T[] | undefined, name: string): T | undefined {
  const needle = name.toLowerCase();
  return items?.find((item) => item.name.toLowerCase() === needle);
}

export function resolveQuickAddProjectId(text: string, projects: Project[] | undefined, defaultProjectId?: string | null): string | null | undefined {
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

  const recurrence = findRecurrence(title);
  if (recurrence.match) title = title.replace(recurrence.match, " ");
  const date = findDate(title, now, recurrence.weekday);
  if (date.match) title = title.replace(date.match, " ");
  const time = findTime(title);
  if (time.match) title = title.replace(time.match, " ");

  const input: CreateTaskInput = { title: title.replace(/\s+/g, " ").trim(), projectId };
  if (section && section.projectId === projectId) input.sectionId = section.id;
  if (tagIds.length) input.tagIds = [...new Set(tagIds)];
  if (priority) input.priority = priority;
  if (recurrence.rule) input.recurrenceRule = recurrence.rule;

  if (time.hour !== undefined) {
    const [year, month, day] = (date.date ?? localDate(now)).split("-").map(Number);
    const due = new Date(year, month - 1, day, time.hour, time.minute ?? 0, 0, 0);
    input.dueAt = due.toISOString();
  } else if (date.date) {
    input.dueDate = date.date;
  }
  return input;
}
