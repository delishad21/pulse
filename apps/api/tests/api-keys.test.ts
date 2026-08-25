import assert from "node:assert/strict";
import test from "node:test";
import { apiKeyPrefix, generateApiKey, hashApiKey, isPulseApiKey } from "../src/lib/api-keys.js";

test("API keys are high-entropy Pulse bearer tokens with stable hashes and safe prefixes", () => {
  const first = generateApiKey();
  const second = generateApiKey();

  assert.match(first, /^pulse_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.equal(isPulseApiKey(first), true);
  assert.equal(isPulseApiKey("pulse_not-a-complete-key"), false);
  assert.equal(hashApiKey(first), hashApiKey(first));
  assert.notEqual(hashApiKey(first), hashApiKey(second));
  assert.equal(apiKeyPrefix(first), first.slice(0, 18));
  assert.equal(apiKeyPrefix(first).includes(first.slice(18)), false);
});
