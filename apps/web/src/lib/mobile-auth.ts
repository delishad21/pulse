import { createHmac, timingSafeEqual } from "node:crypto";

export interface MobileTokenClaims {
  sub: string;
  name: string;
  username: string;
  iat: number;
  exp: number;
}

const TOKEN_VERSION = "pulse-mobile-v1";
const TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is required for mobile authentication");
  return value;
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(`${TOKEN_VERSION}.${payload}`).digest("base64url");
}

export function issueMobileToken(
  user: { id: string; name: string | null; username: string },
  now = new Date(),
): { accessToken: string; expiresAt: string } {
  const iat = Math.floor(now.getTime() / 1000);
  const claims: MobileTokenClaims = {
    sub: user.id,
    name: user.name ?? user.username,
    username: user.username,
    iat,
    exp: iat + TOKEN_LIFETIME_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return {
    accessToken: `${TOKEN_VERSION}.${payload}.${signature(payload)}`,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  };
}

export function verifyMobileToken(token: string, now = new Date()): MobileTokenClaims | null {
  const [version, payload, suppliedSignature, extra] = token.split(".");
  if (version !== TOKEN_VERSION || !payload || !suppliedSignature || extra) return null;

  const expected = Buffer.from(signature(payload));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<MobileTokenClaims>;
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (
      typeof value.sub !== "string" ||
      typeof value.name !== "string" ||
      typeof value.username !== "string" ||
      typeof value.iat !== "number" ||
      typeof value.exp !== "number" ||
      value.exp <= nowSeconds ||
      value.iat > nowSeconds + 60
    ) return null;
    return value as MobileTokenClaims;
  } catch {
    return null;
  }
}

export function readMobileBearerToken(request: Request): MobileTokenClaims | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return verifyMobileToken(header.slice(7));
}
