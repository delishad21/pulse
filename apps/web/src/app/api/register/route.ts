import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@pulse/db/next";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
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
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  const passwordHash = await hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash, timezone: "Asia/Singapore" },
    select: { id: true, email: true },
  });
  return NextResponse.json(user, { status: 201 });
}
