import type { ApiKeySummary, CreatedApiKey } from "@pulse/api-client";
import { Errors } from "../lib/errors.js";
import { apiKeyPrefix, generateApiKey, hashApiKey, isPulseApiKey } from "../lib/api-keys.js";
import type { RequestUser } from "../lib/auth.js";

const MAX_ACTIVE_KEYS = 10;
const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000;

async function getDatabase() {
  return (await import("@pulse/db")).prisma;
}

type ApiKeyRow = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

function serialize(row: ApiKeyRow): ApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

export async function listApiKeys(userId: string): Promise<ApiKeySummary[]> {
  const prisma = await getDatabase();
  const keys = await prisma.apiKey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, tokenPrefix: true, createdAt: true, lastUsedAt: true },
  });
  return keys.map(serialize);
}

export async function createApiKey(userId: string, name: string): Promise<CreatedApiKey> {
  const prisma = await getDatabase();
  const activeCount = await prisma.apiKey.count({ where: { userId, revokedAt: null } });
  if (activeCount >= MAX_ACTIVE_KEYS) throw Errors.Conflict(`Each account can have at most ${MAX_ACTIVE_KEYS} active API keys.`);

  const token = generateApiKey();
  const key = await prisma.apiKey.create({
    data: { userId, name, tokenHash: hashApiKey(token), tokenPrefix: apiKeyPrefix(token) },
    select: { id: true, name: true, tokenPrefix: true, createdAt: true, lastUsedAt: true },
  });
  return { ...serialize(key), token };
}

export async function revokeApiKey(userId: string, id: string): Promise<void> {
  const prisma = await getDatabase();
  const result = await prisma.apiKey.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw Errors.NotFound("API key");
}

export async function resolveApiKey(token: string): Promise<RequestUser | null> {
  if (!isPulseApiKey(token)) return null;
  const prisma = await getDatabase();
  const key = await prisma.apiKey.findUnique({
    where: { tokenHash: hashApiKey(token) },
    include: { user: true },
  });
  if (!key || key.revokedAt) return null;

  const now = new Date();
  if (!key.lastUsedAt || now.getTime() - key.lastUsedAt.getTime() >= LAST_USED_WRITE_INTERVAL_MS) {
    await prisma.apiKey.updateMany({ where: { id: key.id, revokedAt: null }, data: { lastUsedAt: now } });
  }
  return { id: key.user.id, username: key.user.username, name: key.user.name, timezone: key.user.timezone };
}
