import "dotenv/config";
import { hash } from "bcryptjs";
import { prisma } from "@pulse/db";

const username = process.argv[2]?.trim().toLowerCase();
if (!username) {
  console.error("Usage: npm run auth:set-password -w @pulse/api -- <username>");
  process.exit(2);
}

let password = "";
for await (const chunk of process.stdin) {
  password += String(chunk);
}
password = password.replace(/[\r\n]+$/, "");

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(2);
}
try {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error(`No Pulse user exists for ${username}.`);
    process.exitCode = 1;
  } else {
    const passwordHash = await hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    console.log(`Password updated for ${username}.`);
  }
} finally {
  await prisma.$disconnect();
}
