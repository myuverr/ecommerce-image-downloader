import { deepStrictEqual as eq } from "node:assert/strict";
import {
  getFreshSession,
  isFreshSession,
  isValidSessionId,
  limitSessionRecords,
  validateCaptureRequest,
  validateGalleryRequest,
} from "../extension/src/session-protocol.js";

const id = "12345678-abcd-1234-5678-123456789abc";
const origin = "chrome-extension://example";
const sender = {
  id: "example",
  tab: { id: 1 },
  frameId: 0,
  url: "https://page.example.test/item/100",
};
const policy = (url) => url === sender.url;
const request = {
  type: "capture.create",
  title: "商品",
  candidates: [{ kind: "url", value: "/image.jpg" }],
};
const record = (createdAt = 1000000) => ({
  version: 1,
  id,
  createdAt,
  pageUrl: sender.url,
  title: "商品",
  images: [],
});

Deno.test("captureUsesValidatedSenderUrl", () => {
  eq(
    validateCaptureRequest(
      { ...request, pageUrl: "https://attacker.example.test/" },
      sender,
      policy,
    ),
    { ok: true, pageUrl: sender.url },
  );
});
Deno.test("rejectsSubframesAndUnsupportedCaptureSenders", () => {
  for (
    const bad of [
      { ...sender, frameId: 1 },
      { ...sender, tab: undefined },
      { ...sender, id: "" },
      { ...sender, url: "http://page.example.test/item/100" },
      { ...sender, url: "https://attacker.example.test/" },
    ]
  ) {
    eq(validateCaptureRequest(request, bad, policy).ok, false);
  }
});
Deno.test("captureRejectsMalformedAndOversizedMessages", () => {
  const bad = [
    null,
    [],
    {},
    { ...request, type: "other" },
    { ...request, title: 1 },
    { ...request, unexpected: "payload" },
    { ...request, pageUrl: {} },
    { ...request, title: "x".repeat(161) },
    { ...request, candidates: Array(301).fill(request.candidates[0]) },
  ];
  for (
    const candidate of [
      null,
      [],
      {},
      { kind: "url", value: 3 },
      { kind: "html", value: "x" },
      { kind: "url", value: "x", html: "<script>" },
      { kind: "url", value: "x".repeat(2049) },
      { kind: "url", value: "x", width: -1 },
      { kind: "url", value: "x", height: Infinity },
      { kind: "url", value: "x", alt: {} },
      { kind: "url", value: "x", alt: "a".repeat(161) },
    ]
  ) bad.push({ ...request, candidates: [candidate] });
  for (const message of bad) {
    eq(validateCaptureRequest(message, sender, policy).ok, false);
  }
  eq(
    validateCaptureRequest({ ...request, candidates: [] }, sender, policy).ok,
    true,
  );
});
Deno.test("expiredSessionsAreRejected", () => {
  eq(isValidSessionId(id), true);
  for (const value of ["demo", "", null, id + "x"]) {
    eq(isValidSessionId(value), false);
  }
  const now = 3000000;
  eq(isFreshSession(record(now - 1200000), now), true);
  for (
    const session of [null, record(now - 1200001), record(now + 1), {
      ...record(now),
      version: 2,
    }, { ...record(now), createdAt: NaN }]
  ) eq(isFreshSession(session, now), false);
  eq(getFreshSession(record(now - 1000), id, now), record(now - 1000));
  for (const session of [null, record(0), { ...record(now), id: "wrong" }]) {
    eq(getFreshSession(session, id, now), null);
  }
});
Deno.test("limitSessionRecordsKeepsNewestTenAndDeletesExpired", () => {
  const sessions = Object.fromEntries(
    Array.from({ length: 11 }, (_, i) => ["session-" + i, record(2000000 + i)]),
  );
  sessions.expired = record(0);
  const result = limitSessionRecords(sessions, 3000000);
  eq(
    Object.keys(result.keep).sort(),
    Array.from({ length: 10 }, (_, i) => "session-" + (i + 1)).sort(),
  );
  eq(result.remove.sort(), ["expired", "session-0"]);
});
Deno.test("galleryRequestsRequireOwnGalleryAndUuid", () => {
  for (const type of ["gallery.get", "gallery.release"]) {
    const message = { type, sessionId: id };
    eq(
      validateGalleryRequest(
        message,
        origin + "/gallery.html?sessionId=" + id,
        origin,
      ),
      true,
    );
    for (
      const url of [
        "https://example.test/gallery.html",
        "chrome-extension://other/gallery.html",
        origin + "/other.html",
        origin + "/gallery.html/extra",
      ]
    ) eq(validateGalleryRequest(message, url, origin), false);
    eq(
      validateGalleryRequest(
        { ...message, sessionId: "demo" },
        origin + "/gallery.html",
        origin,
      ),
      false,
    );
  }
  eq(validateGalleryRequest(null, origin + "/gallery.html", origin), false);
});
