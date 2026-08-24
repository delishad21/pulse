import { NextResponse } from "next/server";
import { readMobileBearerToken } from "@/lib/mobile-auth";

export function GET(request: Request) {
  const claims = readMobileBearerToken(request);
  if (!claims) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "The mobile session is invalid or expired." } }, { status: 401 });
  }
  return NextResponse.json({ user: { id: claims.sub, name: claims.name, username: claims.username } });
}
