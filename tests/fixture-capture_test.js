import { deepStrictEqual as eq } from "node:assert/strict";
import { createFixtureCapture } from "../extension/src/fixture-capture.js";
Deno.test("fixtureCaptureUsesOnlyThreeFixedBundledImages", () => {
  const capture = createFixtureCapture("chrome-extension://test/");
  eq(capture.id, "demo");
  eq(capture.version, 1);
  eq(capture.images.map((i) => i.url), [
    "chrome-extension://test/fixtures/product-front.svg",
    "chrome-extension://test/fixtures/product-detail.svg",
    "chrome-extension://test/fixtures/product-angle.svg",
  ]);
  eq(capture.images.every((i) => i.width > 0 && i.height > 0), true);
});
