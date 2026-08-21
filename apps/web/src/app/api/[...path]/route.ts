import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const apiOrigin = process.env.PULSE_API_INTERNAL_URL ?? "http://127.0.0.1:4000";
type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const authDisabled = process.env.PULSE_AUTH_DISABLED === "true";
  const session = authDisabled ? null : await auth();
  if (!authDisabled && !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await context.params;
  const target = new URL(`/api/${path.join("/")}`, apiOrigin);
  target.search = request.nextUrl.search;
  const headers = new Headers(request.headers);
  for (const name of ["host", "content-length", "x-pulse-user-id"]) headers.delete(name);
  const webToken = process.env.PULSE_WEB_TOKEN;
  if (webToken) headers.set("authorization", `Bearer ${webToken}`);
  if (session?.user?.id) headers.set("x-pulse-user-id", session.user.id);

  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  const response = await fetch(target, { method, headers, body, redirect: "manual" });
  const responseHeaders = new Headers(response.headers);
  for (const name of ["content-length", "content-encoding", "transfer-encoding"]) {
    responseHeaders.delete(name);
  }
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const PUT = proxy;
