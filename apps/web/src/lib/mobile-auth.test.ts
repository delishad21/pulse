import assert from "node:assert/strict";
import test from "node:test";
import { issueMobileToken, verifyMobileToken } from "./mobile-auth";

test("mobile tokens are signed, expire, and reject tampering", () => {
  process.env.AUTH_SECRET = "test-mobile-secret";
  const now = new Date("2026-08-24T10:00:00.000Z");
  const { accessToken } = issueMobileToken({ id: "user-1", name: "Johan", username: "johan" }, now);
  assert.equal(verifyMobileToken(accessToken, now)?.sub, "user-1");
  assert.equal(verifyMobileToken(`${accessToken}x`, now), null);
  assert.equal(verifyMobileToken(accessToken, new Date("2026-10-01T10:00:00.000Z")), null);
});
