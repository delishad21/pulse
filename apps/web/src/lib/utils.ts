export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00Z`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function localDateKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isToday(dateString: string | null, now = new Date()): boolean {
  if (!dateString) return false;
  return dateString === localDateKey(now);
}

export function isOverdue(dateString: string | null, now = new Date()): boolean {
  if (!dateString) return false;
  return dateString < localDateKey(now);
}
