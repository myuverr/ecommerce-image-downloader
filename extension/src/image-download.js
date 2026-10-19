import { assertAllowedImageUrl } from "./image-candidates.js";

const MAX_BYTES = 12 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30000;
const CONVERT_TIMEOUT_MS = 30000;

export function validateImageResponse(response) {
  if (!response.ok) throw new Error(`图片请求失败（HTTP ${response.status}）`);
  if (!/^image\//i.test(response.headers.get("Content-Type") ?? "")) {
    throw new Error("响应不是图片");
  }
}
export function validateImageBlob(blob) {
  if (blob.size > MAX_BYTES) throw new Error("图片超过 12 MiB");
}
export function assertSafeImageDimensions(width, height) {
  if (
    !Number.isInteger(width) || !Number.isInteger(height) ||
    width <= 0 || height <= 0 || width > 8192 || height > 8192 ||
    width * height > 40000000
  ) throw new Error("图片尺寸超限或无效");
}

export async function fetchImageBlob(url, allowedOrigins, fetchImpl = fetch) {
  const requestUrl = assertAllowedImageUrl(url, allowedOrigins);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("图片读取超时，可重试")),
    FETCH_TIMEOUT_MS,
  );
  let response;
  let reader;
  try {
    response = await fetchImpl(requestUrl, {
      credentials: "omit",
      signal: controller.signal,
    });
    assertAllowedImageUrl(response.url, allowedOrigins);
    validateImageResponse(response);
    if (Number(response.headers.get("Content-Length")) > MAX_BYTES) {
      throw new Error("图片超过 12 MiB");
    }
    if (!response.body) throw new Error("图片响应为空");
    reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("图片超过 12 MiB");
      chunks.push(value);
    }
    const blob = new Blob(chunks, {
      type: response.headers.get("Content-Type"),
    });
    validateImageBlob(blob);
    return blob;
  } finally {
    clearTimeout(timer);
    if (reader) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    } else if (response?.body) {
      await response.body.cancel().catch(() => {});
    }
  }
}

export async function convertBlobToPng(blob) {
  validateImageBlob(blob);
  let bitmap;
  let svgImage;
  let svgUrl;
  let canvas;
  let timer;
  let expired = false;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(new Error("图片转换超时，可重试"));
    }, CONVERT_TIMEOUT_MS);
  });
  try {
    let source;
    let width;
    let height;
    // Chrome cannot decode SVG Blobs with createImageBitmap. Image mode keeps
    // SVG inert (no markup injection) and the temporary URL is always released.
    if (/^image\/svg\+xml(?:;|$)/i.test(blob.type)) {
      svgImage = new Image();
      svgUrl = URL.createObjectURL(blob);
      svgImage.src = svgUrl;
      await Promise.race([svgImage.decode(), timeout]);
      source = svgImage;
      width = svgImage.naturalWidth;
      height = svgImage.naturalHeight;
    } else {
      bitmap = await Promise.race([
        createImageBitmap(blob).then((decoded) => {
          if (expired) {
            decoded.close();
            throw new Error("图片解码超时");
          }
          return decoded;
        }),
        timeout,
      ]);
      source = bitmap;
      width = bitmap.width;
      height = bitmap.height;
    }
    assertSafeImageDimensions(width, height);
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建画布");
    context.drawImage(source, 0, 0);
    return await Promise.race([
      new Promise((resolve, reject) => {
        canvas.toBlob((png) => {
          if (!png || png.type !== "image/png") {
            reject(new Error("PNG 导出失败"));
          } else resolve(png);
        }, "image/png");
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
    bitmap?.close();
    svgImage?.removeAttribute("src");
    if (svgUrl) URL.revokeObjectURL(svgUrl);
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
