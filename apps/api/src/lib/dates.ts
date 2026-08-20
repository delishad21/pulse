export function startOfDayUTC(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function endOfDayUTC(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
