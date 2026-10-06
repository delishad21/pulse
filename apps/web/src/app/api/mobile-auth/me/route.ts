import { NextResponse } from "next/server";
import { issueMobileToken, readMobileBearerToken } from "@/lib/mobile-auth";

export function GET(request: Request) {
  const claims = readMobileBearerToken(request);
  if (!claims) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "The mobile session is invalid or expired." } }, { status: 401 });
  }
  const user = { id: claims.sub, name: claims.name, username: claims.username };
  // Renew on every check so an active session never reaches its expiry.
  return NextResponse.json({ ...issueMobileToken(user), user });
}
