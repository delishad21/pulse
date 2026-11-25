import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { INVISIBLE_TEXT_COLOR } from "./title-highlight.ts";

const normalizeColor = createRequire(import.meta.url)("@react-native/normalize-colors") as (color: string) => number | null;
// Same RGBA to ARGB conversion as React Native's processColor.
const toArgb = (color: string) => { const rgba = normalizeColor(color); assert.ok(rgba !== null); return ((rgba << 24) | (rgba >>> 8)) >>> 0; };

test("the title highlight's text colour is invisible without being Android's unset colour", () => {
  assert.equal(toArgb("transparent"), 0, "transparent is the value Android treats as unset");
  assert.notEqual(toArgb(INVISIBLE_TEXT_COLOR), 0);
  assert.equal(toArgb(INVISIBLE_TEXT_COLOR) >>> 24, 0);
});
