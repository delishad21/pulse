import { createHash, randomBytes } from "node:crypto";

const API_KEY_PREFIX = "pulse_";
const API_KEY_PATTERN = /^pulse_[A-Za-z0-9_-]{43}$/;

export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function apiKeyPrefix(token: string): string {
  return token.slice(0, API_KEY_PREFIX.length + 12);
}

export function isPulseApiKey(token: string): boolean {
  return API_KEY_PATTERN.test(token);
}
