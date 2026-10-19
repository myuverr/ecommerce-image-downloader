import { deepStrictEqual as eq, throws } from "node:assert/strict";
import { observeDownload, parseGalleryRoute } from "../extension/gallery.js";

Deno.test("parseGalleryRouteRejectsMissingMixedAndArbitraryModes", () => {
  eq(parseGalleryRoute("?demo=1"), { mode: "demo" });
  eq(parseGalleryRoute("?sessionId=abc"), {
    mode: "session",
    sessionId: "abc",
  });
  for (
    const query of [
      "",
      "?demo=0",
      "?demo=1&sessionId=x",
      "?sessionId=",
      "?demo=1&path=evil",
      "?demo=1&demo=1",
    ]
  ) {
    throws(() => parseGalleryRoute(query));
  }
});
function downloads(items) {
  const listeners = new Set();
  return {
    onChanged: {
      addListener(fn) {
        listeners.add(fn);
      },
      removeListener(fn) {
        listeners.delete(fn);
      },
    },
    search({ id }) {
      eq(id, 7);
      return Promise.resolve(items);
    },
    emit(delta) {
      for (const listener of listeners) listener(delta);
    },
    count() {
      return listeners.size;
    },
  };
}
Deno.test("observeDownloadSearchCoversEarlyCompletionAndCleansListener", async () => {
  const api = downloads([{ id: 7, state: "complete" }]);
  const states = [];
  const watch = observeDownload(api, 7, (...state) => states.push(state));
  eq(await watch.settled, "complete");
  eq(states, [["complete", "下载完成"]]);
  eq(api.count(), 0);
});
Deno.test("observeDownloadDoesNotCompleteOnAcceptanceAndAllowsLateTerminalAfterTimeout", async () => {
  const api = downloads([{ id: 7, state: "in_progress" }]);
  const states = [];
  const watch = observeDownload(api, 7, (...state) => states.push(state), 5);
  eq(await watch.settled, "unknown");
  eq(states.at(-1), ["submitted", "状态未知，仍在等待"]);
  eq(api.count(), 1);
  api.emit({ id: 8, state: { current: "complete" } });
  eq(states.at(-1)[0], "submitted");
  api.emit({
    id: 7,
    state: { current: "interrupted" },
    error: { current: "USER_CANCELED" },
  });
  eq(states.at(-1), ["interrupted", "下载中断（USER_CANCELED），可重试"]);
  eq(api.count(), 0);
});
Deno.test("observeDownloadDisposeStopsWaitingAndIgnoresStaleSearch", async () => {
  const api = downloads([{ id: 7, state: "complete" }]);
  const states = [];
  const watch = observeDownload(api, 7, (...state) => states.push(state));
  watch.dispose();
  eq(await watch.settled, "closed");
  await Promise.resolve();
  eq(states, []);
  eq(api.count(), 0);
});
