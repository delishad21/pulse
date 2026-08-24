import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((request) => {
  if (process.env.PULSE_AUTH_DISABLED === "true") return NextResponse.next();
  const pathname = request.nextUrl.pathname;
  const authPage = pathname === "/login" || pathname === "/register";
  if (request.auth && authPage) return NextResponse.redirect(new URL("/inbox", request.url));
  if (!request.auth && !authPage) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
