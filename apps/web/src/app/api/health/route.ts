import { NextResponse } from "next/server";

const apiOrigin = process.env.PULSE_API_INTERNAL_URL ?? "http://127.0.0.1:4000";

// Public deploy/uptime probe: healthy only when the web app can reach an API
// that can reach the database. Takes precedence over the authenticated
// `/api/[...path]` proxy, and the auth proxy matcher already skips `/api`.
export async function GET() {
  try {
    const response = await fetch(new URL("/api/health/ready", apiOrigin), {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) return NextResponse.json({ status: "ok", service: "pulse-web" });
  } catch {
    // Reported as unavailable below.
  }
  return NextResponse.json({ status: "error", service: "pulse-web" }, { status: 503 });
}
