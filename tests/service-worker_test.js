import { deepStrictEqual as eq } from "node:assert/strict";

Deno.test("workerValidatesStoresSerializesReadsExpiresAndReleases", async () => {
  const saved = globalThis.chrome;
  const savedNow = Date.now;
  const fixedNow = Date.now();
  Date.now = () => fixedNow;
  const records = {};
  const opened = [];
  let listener;
  const id = "test-extension";
  const gallerySender = {
    id,
    frameId: 0,
    url: "chrome-extension://" + id + "/gallery.html",
  };
  const sender = {
    id,
    tab: { id: 1 },
    frameId: 0,
    url: "https://product.suning.com/123/456.html",
  };
  const message = {
    type: "capture.create",
    title: "<b>text only</b>",
    candidates: [{ kind: "url", value: "https://imgservice.suning.cn/a.jpg" }],
  };
  globalThis.chrome = {
    runtime: {
      id,
      getURL: (path) => "chrome-extension://" + id + "/" + path,
      onMessage: {
        addListener(fn) {
          listener = fn;
        },
      },
    },
    storage: {
      session: {
        async get() {
          await Promise.resolve();
          return structuredClone(records);
        },
        set(items) {
          Object.assign(records, structuredClone(items));
          return Promise.resolve();
        },
        remove(keys) {
          for (
            const key of Array.isArray(keys) ? keys : [keys]
          ) delete records[key];
          return Promise.resolve();
        },
      },
    },
    tabs: {
      create(options) {
        opened.push(options.url);
        return Promise.resolve();
      },
    },
    action: { onClicked: { addListener() {} } },
  };
  try {
    await import("../extension/service-worker.js");
    const send = (request, from = sender) =>
      new Promise((resolve) => {
        eq(listener(request, from, resolve), true);
      });
    eq(await send(message, { ...sender, id: "evil" }), {
      ok: false,
      code: "invalid-request",
    });
    eq(await send(message, { ...sender, frameId: 1 }), {
      ok: false,
      code: "invalid-request",
    });
    eq(await send({ ...message, candidates: [] }), {
      ok: false,
      code: "no-images",
    });
    eq(
      await send({
        ...message,
        candidates: [{ kind: "url", value: "https://evil.test/a.jpg" }],
      }),
      { ok: false, code: "no-images" },
    );
    eq(opened.length, 0);
    const captures = await Promise.all(
      Array.from({ length: 12 }, () => send(message)),
    );
    eq(captures.every((item) => item.ok), true);
    eq(Object.keys(records).length, 10);
    const sessionId = captures[11].sessionId;
    const get = { type: "gallery.get", sessionId };
    const response = await send(get, gallerySender);
    eq(Object.keys(response).sort(), ["capture", "ok"]);
    eq(response.capture.pageUrl, sender.url);
    eq(response.capture.title, "<b>text only</b>");
    eq(response.capture.images.length, 1);
    eq(await send(get, sender), { ok: false, code: "invalid-request" });
    eq(await send(get, { ...gallerySender, frameId: 1 }), {
      ok: false,
      code: "invalid-request",
    });
    eq(await send({ type: "gallery.release", sessionId }, gallerySender), {
      ok: true,
    });
    eq(await send(get, gallerySender), {
      ok: false,
      code: "session-not-found",
    });
    const expiredId = captures[10].sessionId;
    records["session:" + expiredId].createdAt = Date.now() - 1200001;
    eq(await send({ ...get, sessionId: expiredId }, gallerySender), {
      ok: false,
      code: "expired-session",
    });
    eq(Object.hasOwn(records, "session:" + expiredId), false);
    const original = chrome.storage.session.get;
    chrome.storage.session.get = () => {
      throw new Error("storage unavailable");
    };
    eq(await send(get, gallerySender), { ok: false, code: "internal-error" });
    chrome.storage.session.get = original;
  } finally {
    globalThis.chrome = saved;
    Date.now = savedNow;
  }
});
