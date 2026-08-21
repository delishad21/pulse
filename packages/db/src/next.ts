import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client.ts";

const globalForPrisma = globalThis as typeof globalThis & {
  pulsePrisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const prisma = globalForPrisma.pulsePrisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.pulsePrisma = prisma;
