import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrismaClient } from "@pulse/db/next";
import { issueMobileToken } from "@/lib/mobile-auth";

const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password." } }, { status: 401 });
  }

  const user = await getPrismaClient().user.findUnique({ where: { username: parsed.data.username } });
  if (!user?.passwordHash || !(await compare(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password." } }, { status: 401 });
  }

  const token = issueMobileToken(user);
  return NextResponse.json({
    ...token,
    user: { id: user.id, name: user.name ?? user.username, username: user.username },
  });
}
