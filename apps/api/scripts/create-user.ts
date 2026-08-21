import "dotenv/config";
import { hash } from "bcryptjs";
import { prisma } from "@pulse/db";

const username = process.argv[2]?.trim().toLowerCase();
if (!username || !/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error("Usage: npm run auth:create-user -w @pulse/api -- <username>");
  process.exit(2);
}

let password = "";
for await (const chunk of process.stdin) password += String(chunk);
password = password.replace(/[\r\n]+$/, "");
if (password.length < 8 || password.length > 128) {
  console.error("Password must be 8-128 characters.");
  process.exit(2);
}

try {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing?.passwordHash) {
    console.error(`Pulse user ${username} already exists.`);
    process.exitCode = 1;
  } else {
    const passwordHash = await hash(password, 12);
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, name: existing.name ?? username },
      });
      console.log(`Activated Pulse user ${username}.`);
    } else {
      await prisma.user.create({
        data: { username, name: username, passwordHash, timezone: "Asia/Singapore" },
      });
      console.log(`Created Pulse user ${username}.`);
    }
  }
} finally {
  await prisma.$disconnect();
}
