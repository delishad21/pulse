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

export function isToday(dateString: string | null): boolean {
  if (!dateString) return false;
  return dateString === new Date().toISOString().slice(0, 10);
}

export function isOverdue(dateString: string | null): boolean {
  if (!dateString) return false;
  return dateString < new Date().toISOString().slice(0, 10);
}
