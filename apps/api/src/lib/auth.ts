import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { UserId } from "@pulse/domain";
import { Errors } from "./errors.js";

export interface RequestUser {
  id: UserId;
  email: string;
  name: string | null;
  timezone: string;
}

export interface AuthOptions {
  webToken?: string;
  serviceToken?: string;
  requireAuth?: boolean;
  resolveUser?: (id: string) => Promise<RequestUser | null>;
}

declare module "fastify" {
  interface FastifyRequest {
    user: RequestUser;
  }
}
function tokenMatches(candidate: string, expected?: string): boolean {
  if (!expected) return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function registerAuth(
  app: FastifyInstance,
  defaultUser: RequestUser,
  options: AuthOptions = {},
): Promise<void> {
  const requireAuth = options.requireAuth ?? Boolean(options.webToken || options.serviceToken);
  app.decorateRequest("user", null as unknown as RequestUser);
  app.addHook("onRequest", async (request) => {
    request.user = defaultUser;
    if (request.url.startsWith("/api/health")) return;
    if (!requireAuth) return;

    const token = bearerToken(request);
    if (!token) throw Errors.Unauthorized();
    if (tokenMatches(token, options.serviceToken)) return;

    if (tokenMatches(token, options.webToken)) {
      const raw = request.headers["x-pulse-user-id"];
      const userId = Array.isArray(raw) ? raw[0] : raw;
      if (!userId || !options.resolveUser) throw Errors.Unauthorized();
      const user = await options.resolveUser(userId);
      if (!user) throw Errors.Unauthorized();
      request.user = user;
      return;
    }

    throw Errors.Unauthorized();
  });
}

export function getUser(request: FastifyRequest): RequestUser {
  if (!request.user) throw new Error("User not attached to request");
  return request.user;
}
