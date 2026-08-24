import { requireValidDateOnly } from "@pulse/domain";
import { z, type ZodTypeAny, type ZodError } from "zod";
import { Errors } from "./errors.js";

export const PrioritySchema = z.enum(["none", "low", "medium", "high", "urgent"]);
export const ProjectStatusSchema = z.enum(["active", "archived", "completed"]);
export const ISOInstantSchema = z.string().datetime({ offset: true });
export const ISODateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  try { requireValidDateOnly(value); return true; }
  catch { return false; }
}, "Date must be a real calendar date in YYYY-MM-DD format");

function formatZodIssues(error: ZodError): Record<string, unknown> {
  return { issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) };
}

export function parseBody<T>(schema: ZodTypeAny, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw Errors.Validation("Invalid request body.", formatZodIssues(result.error));
  }
  return result.data as T;
}

export function parseParams<T extends Record<string, string>>(
  schema: z.ZodObject<Record<keyof T, ZodTypeAny>>,
  params: unknown,
): T {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw Errors.Validation("Invalid URL parameters.", formatZodIssues(result.error));
  }
  return result.data as T;
}
