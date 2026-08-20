export function json<T>(res: { json: (body: T) => void }, body: T): void {
  res.json(body);
}
