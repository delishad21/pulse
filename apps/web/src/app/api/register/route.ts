import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getPrismaClient } from "@pulse/db/next";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  if (process.env.PULSE_REGISTRATION_ENABLED !== "true") {
    return NextResponse.json({ error: "Registration is disabled." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid registration details." }, { status: 400 });
  }
  const prisma = getPrismaClient();
  const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (existing) return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  const passwordHash = await hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: { name: parsed.data.name, username: parsed.data.username, passwordHash, timezone: "Asia/Singapore" },
    select: { id: true, username: true },
  });
  return NextResponse.json(user, { status: 201 });
}
