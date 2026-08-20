import type { FastifyInstance, FastifyRequest } from "fastify";
import type { UserId } from "@pulse/domain";

export interface RequestUser {
  id: UserId;
  email: string;
  name: string | null;
  timezone: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user: RequestUser;
  }
}

export async function registerAuth(app: FastifyInstance, defaultUser: RequestUser): Promise<void> {
  app.decorateRequest("user", {
    getter() {
      return defaultUser;
    },
    setter() {
      // user is read-only; assignments are ignored
    },
  });
  app.addHook("onRequest", async (req: FastifyRequest) => {
    req.user = defaultUser;
  });
}

export function getUser(req: FastifyRequest): RequestUser {
  const user = req.user;
  if (!user) throw new Error("User not attached to request");
  return user;
}
