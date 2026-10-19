import { deepStrictEqual as eq } from "node:assert/strict";
Deno.test("contentCollectsBoundedCandidatesWithoutPlaceholderDimensionsOnLazySources", async () => {
  const saved = Object.fromEntries(
    ["document", "location", "top", "chrome", "NodeFilter", "getComputedStyle"]
      .map((key) => [key, globalThis[key]]),
  );
  let onClick;
  let visits = 0;
  let sent;
  const element = {
    tagName: "IMG",
    currentSrc: "https://imgservice.suning.cn/placeholder.gif",
    naturalWidth: 1,
    naturalHeight: 1,
    alt: "title",
    getAttribute(name) {
      return ({
        src: this.currentSrc,
        "data-src": "https://imgservice.suning.cn/full.jpg",
        srcset: "https://imgservice.suning.cn/large.jpg 2x",
      })[name] ?? null;
    },
    getClientRects: () => [1],
  };
  const button = {
    style: {},
    addEventListener(_type, callback) {
      onClick = callback;
    },
  };
  const root = { append() {} };
  const host = { style: {}, attachShadow: () => root };
  globalThis.top = globalThis;
  globalThis.location = new URL("https://product.suning.com/123/456.html");
  globalThis.NodeFilter = { SHOW_ELEMENT: 1 };
  globalThis.getComputedStyle = () => ({
    display: "block",
    visibility: "visible",
    backgroundImage: "none",
  });
  globalThis.document = {
    title: "Product",
    documentElement: { append() {} },
    createElement: (tag) => tag === "button" ? button : host,
    createTreeWalker: () => ({
      nextNode() {
        visits++;
        return visits <= 6000 ? element : null;
      },
    }),
  };
  globalThis.chrome = {
    runtime: {
      sendMessage(message) {
        sent = message;
        return Promise.resolve({ ok: false, code: "no-images" });
      },
    },
  };
  try {
    await import("../extension/content.js");
    eq(typeof onClick, "function");
    await onClick();
    eq(sent.type, "capture.create");
    eq(sent.candidates.length, 300);
    eq(visits <= 5000, true);
    eq(sent.candidates[0].width, 1);
    const lazy = sent.candidates.find((c) => c.value.endsWith("/full.jpg"));
    eq(lazy.width, undefined);
    eq(lazy.height, undefined);
    eq(sent.candidates.find((c) => c.kind === "srcset").width, undefined);
    eq(button.textContent, "未找到可用图片");
  } finally {
    for (const [key, value] of Object.entries(saved)) globalThis[key] = value;
  }
});
