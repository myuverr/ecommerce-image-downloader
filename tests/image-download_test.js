import { deepStrictEqual as eq, rejects, throws } from "node:assert/strict";
import {
  assertSafeImageDimensions,
  convertBlobToPng,
  fetchImageBlob,
  validateImageBlob,
  validateImageResponse,
} from "../extension/src/image-download.js";
const origin = ["https://images.example.test"];
const url = origin[0] + "/a.jpg";
const limit = 12 * 1024 * 1024;
function response(body, options = {}) {
  const result = new Response(body, {
    headers: { "Content-Type": "image/jpeg", ...options.headers },
    status: options.status ?? 200,
  });
  Object.defineProperty(result, "url", { value: options.url ?? url });
  return result;
}
Deno.test("validateImageResponseRejectsHttpAndNonImageResponses", () => {
  validateImageResponse(response(""));
  throws(() => validateImageResponse(response("", { status: 404 })));
  throws(() =>
    validateImageResponse(
      response("", { headers: { "Content-Type": "text/html" } }),
    )
  );
  throws(() => validateImageResponse(new Response("")));
});
Deno.test("validateImageBlobEnforcesTwelveMiB", () => {
  validateImageBlob(new Blob([new Uint8Array(limit)]));
  throws(() => validateImageBlob(new Blob([new Uint8Array(limit + 1)])));
});
Deno.test("assertSafeImageDimensionsRejectsUnsafeDimensions", () => {
  assertSafeImageDimensions(6000, 6000);
  for (
    const [w, h] of [[0, 200], [8193, 1], [7000, 7000], [-1, 1], [NaN, 1], [
      1.5,
      2,
    ]]
  ) {
    throws(() => assertSafeImageDimensions(w, h));
  }
});
Deno.test("fetchImageBlobRejectsUnapprovedRedirect", async () => {
  let called = false;
  await rejects(() =>
    fetchImageBlob("https://bad.test/a", origin, () => {
      called = true;
    })
  );
  eq(called, false);
  await rejects(() =>
    fetchImageBlob(
      url,
      origin,
      () => response("", { url: "https://unapproved.example.test/x.jpg" }),
    )
  );
});
Deno.test("fetchImageBlobOmitsCredentialsAndReturnsBytes", async () => {
  const blob = await fetchImageBlob(url, origin, (input, options) => {
    eq(input, url);
    eq(options.credentials, "omit");
    eq(options.signal instanceof AbortSignal, true);
    return response("abc");
  });
  eq(await blob.text(), "abc");
});
Deno.test("fetchImageBlobRejectsContentLengthBeforeReading", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    cancel() {
      cancelled = true;
    },
  });
  await rejects(() =>
    fetchImageBlob(
      url,
      origin,
      () =>
        response(stream, { headers: { "Content-Length": String(limit + 1) } }),
    )
  );
  eq(cancelled, true);
});
Deno.test("fetchImageBlobStopsOversizedStreamWithoutReadingRemainder", async () => {
  let reads = 0;
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      reads++;
      controller.enqueue(new Uint8Array(1024 * 1024));
    },
    cancel() {
      cancelled = true;
    },
  }, { highWaterMark: 0 });
  await rejects(() => fetchImageBlob(url, origin, () => response(stream)));
  eq(reads, 13);
  eq(cancelled, true);
});
for (const broken of [false, true]) {
  Deno.test(
    broken
      ? "convertSvgRejectsBadDecodeAndRevokesUrl"
      : "convertSvgUsesImageDecodeAndReleasesUrlAndCanvas",
    async () => {
      const saved = {
        Image: globalThis.Image,
        document: globalThis.document,
        createImageBitmap: globalThis.createImageBitmap,
        create: URL.createObjectURL,
        revoke: URL.revokeObjectURL,
      };
      const revoked = [];
      let image;
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage(source) {
            eq(source, image);
          },
        }),
        toBlob: (callback) =>
          callback(new Blob(["png"], { type: "image/png" })),
      };
      globalThis.Image = class {
        constructor() {
          image = this;
          this.naturalWidth = 640;
          this.naturalHeight = 800;
        }
        decode() {
          return broken
            ? Promise.reject(new Error("bad SVG"))
            : Promise.resolve();
        }
        removeAttribute(name) {
          eq(name, "src");
          this.src = "";
        }
      };
      globalThis.document = { createElement: () => canvas };
      globalThis.createImageBitmap = () =>
        Promise.reject(new Error("SVG bitmap decoder unsupported"));
      URL.createObjectURL = (blob) => {
        eq(blob.type, "image/svg+xml");
        return "blob:svg-test";
      };
      URL.revokeObjectURL = (url) => revoked.push(url);
      try {
        const work = () =>
          convertBlobToPng(new Blob(["<svg/>"], { type: "image/svg+xml" }));
        if (broken) await rejects(work, /bad SVG/);
        else eq((await work()).type, "image/png");
        eq(revoked, ["blob:svg-test"]);
        eq(image.src, "");
        eq([canvas.width, canvas.height], [0, 0]);
      } finally {
        globalThis.Image = saved.Image;
        globalThis.document = saved.document;
        globalThis.createImageBitmap = saved.createImageBitmap;
        URL.createObjectURL = saved.create;
        URL.revokeObjectURL = saved.revoke;
      }
    },
  );
}
Deno.test("convertBlobToPngClosesBitmapAndReleasesCanvasOnExportFailure", async () => {
  const savedBitmap = globalThis.createImageBitmap;
  const savedDocument = globalThis.document;
  let closed = 0;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage() {} }),
    toBlob: (callback) => callback(null),
  };
  globalThis.createImageBitmap = () =>
    Promise.resolve({
      width: 20,
      height: 30,
      close() {
        closed++;
      },
    });
  globalThis.document = { createElement: () => canvas };
  try {
    await rejects(() => convertBlobToPng(new Blob(["a"])));
    eq(closed, 1);
    eq([canvas.width, canvas.height], [0, 0]);
  } finally {
    globalThis.createImageBitmap = savedBitmap;
    globalThis.document = savedDocument;
  }
});
