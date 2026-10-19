import { assertAllowedImageUrl } from "./src/image-candidates.js";
import {
  invertSelection,
  pendingDownloadImages,
  pngFilename,
  selectAll,
  toggleSelection,
} from "./src/gallery-state.js";
import {
  convertBlobToPng,
  fetchImageBlob,
  validateImageBlob,
  validateImageResponse,
} from "./src/image-download.js";

export function parseGalleryRoute(search) {
  const params = new URLSearchParams(search);
  if ([...params].length !== 1) {
    throw new Error("请从获取图片按钮或本地演示入口打开图库");
  }
  if (params.get("demo") === "1") return { mode: "demo" };
  if (params.has("sessionId") && params.get("sessionId")) {
    return { mode: "session", sessionId: params.get("sessionId") };
  }
  throw new Error("图库入口无效");
}

export function observeDownload(api, id, onState, timeoutMs = 120000) {
  let active = true;
  let resolve;
  const settled = new Promise((done) => {
    resolve = done;
  });
  const dispose = (result = "closed") => {
    active = false;
    clearTimeout(timer);
    api.onChanged.removeListener(listener);
    resolve(result);
  };
  const apply = (state, error) => {
    if (!active) return;
    if (state === "complete" || state === "interrupted") {
      onState(
        state,
        state === "complete"
          ? "下载完成"
          : `下载中断（${error || "未知原因"}），可重试`,
      );
      dispose(state);
    } else if (state === "in_progress") {
      onState("in_progress", "已提交 / 下载进行中");
    }
  };
  const listener = (delta) => {
    if (delta.id === id && delta.state) {
      apply(delta.state.current, delta.error?.current);
    }
  };
  const timer = setTimeout(() => {
    if (active) {
      onState("submitted", "状态未知，仍在等待");
      resolve("unknown");
    }
  }, timeoutMs);
  api.onChanged.addListener(listener);
  // The event could precede listener registration; search only after subscribing.
  Promise.resolve().then(() => api.search({ id })).then((items) => {
    if (!active) return;
    const item = items[0];
    if (item) {
      apply(item.state, item.error);
    }
  }).catch(
    () => {/* Keep listening until a terminal event arrives. */},
  );
  return { settled, dispose };
}

async function fixtureBlob(url, resources) {
  if (!resources.has(url)) throw new Error("不是固定演示图片");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let response;
  let reader;
  try {
    response = await fetch(url, {
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
    if (response.url !== url) throw new Error("演示图片地址不匹配");
    validateImageResponse(response);
    if (Number(response.headers.get("Content-Length")) > 12 * 1024 * 1024) {
      throw new Error("图片超过 12 MiB");
    }
    reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 12 * 1024 * 1024) throw new Error("图片超过 12 MiB");
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
    } else await response?.body?.cancel().catch(() => {});
  }
}

function deadline(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function startGallery() {
  const $ = (id) => document.getElementById(id);
  const grid = $("gallery");
  const status = $("message");
  let closed = false;
  let busy = false;
  let images = [];
  let selected = new Set();
  const statuses = {};
  const cards = new Map();
  const urls = new Set();
  const watches = new Set();
  let route;
  let loadBlob;
  let conversionQueue = Promise.resolve();
  let batchIds = [];
  let processed = 0;
  const releaseUrl = (url) => {
    URL.revokeObjectURL(url);
    urls.delete(url);
  };
  const summary = () => {
    const counts = { complete: 0, failed: 0, waiting: 0 };
    for (const id of batchIds) {
      if (statuses[id] === "complete") counts.complete++;
      else if (["failed", "interrupted"].includes(statuses[id])) {
        counts.failed++;
      } else counts.waiting++;
    }
    $("progress").max = Math.max(batchIds.length, 1);
    $("progress").value = processed;
    $("batch-summary").textContent = batchIds.length
      ? `本批已处理 ${processed}/${batchIds.length} · 完成 ${counts.complete} · 失败/中断 ${counts.failed} · 等待/未知 ${counts.waiting}`
      : "选择图片后，逐张转换并下载 PNG";
  };
  const updateControls = () => {
    $("selection-count").textContent =
      `已选 ${selected.size} / ${images.length}`;
    for (const id of ["select-all", "invert", "download"]) {
      $(id).disabled = busy || !images.length;
    }
    for (const [id, card] of cards) {
      card.checkbox.checked = selected.has(id);
      card.checkbox.disabled = busy;
    }
  };
  const setStatus = (id, state, text) => {
    statuses[id] = state;
    cards.get(id).state.textContent = text;
    cards.get(id).state.dataset.state = state;
    summary();
  };
  const convert = (image) => {
    const work = conversionQueue.then(async () => {
      if (closed) throw new Error("图库已关闭");
      const blob = await loadBlob(image.url);
      if (closed) throw new Error("图库已关闭");
      return convertBlobToPng(blob);
    });
    conversionQueue = work.catch(() => {});
    return work;
  };
  globalThis.addEventListener("pagehide", () => {
    closed = true;
    for (const watch of watches) watch.dispose();
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
    for (const card of cards.values()) card.preview.removeAttribute("src");
    if (route?.mode === "session") {
      chrome.runtime.sendMessage({
        type: "gallery.release",
        sessionId: route.sessionId,
      }).catch(() => {});
    }
  }, { once: true });
  $("select-all").addEventListener("click", () => {
    selected = selectAll(images.map((i) => i.id));
    updateControls();
  });
  $("invert").addEventListener("click", () => {
    selected = invertSelection(images.map((i) => i.id), selected);
    updateControls();
  });
  $("download").addEventListener("click", async () => {
    if (busy || closed) return;
    const pending = pendingDownloadImages(images, selected, statuses);
    if (!pending.length) {
      status.textContent = selected.size
        ? "所选图片已完成或仍在等待下载终态"
        : "请先选择图片";
      return;
    }
    busy = true;
    batchIds = pending.map((i) => i.id);
    processed = 0;
    status.textContent = "正在逐张处理，请勿关闭图库";
    updateControls();
    summary();
    try {
      for (const image of pending) {
        if (closed) break;
        let objectUrl;
        try {
          setStatus(image.id, "pending", "正在读取并转换 PNG…");
          const png = await convert(image);
          if (closed) break;
          objectUrl = URL.createObjectURL(png);
          urls.add(objectUrl);
          setStatus(image.id, "submitted", "正在提交下载…");
          // Keep observing late API acceptance, even if the UI wait expires.
          const submission = chrome.downloads.download({
            url: objectUrl,
            filename: pngFilename(images.indexOf(image) + 1),
            saveAs: false,
          }).then(async (id) => {
            if (closed) return;
            if (!Number.isInteger(id)) throw new Error("下载未返回有效编号");
            setStatus(image.id, "submitted", "已提交 / 等待下载终态");
            const watch = observeDownload(
              chrome.downloads,
              id,
              (state, text) => {
                if (closed) return;
                setStatus(image.id, state, text);
                if (state === "complete" || state === "interrupted") {
                  releaseUrl(objectUrl);
                  watches.delete(watch);
                }
              },
            );
            watches.add(watch);
            await watch.settled;
            // Unknown observations must remain registered for the eventual terminal event.
          }).catch((error) => {
            if (!closed) {
              setStatus(
                image.id,
                "failed",
                `提交失败，可重试：${error.message}`,
              );
            }
            releaseUrl(objectUrl);
          });
          try {
            await deadline(submission, 120000, "状态未知，仍在等待");
          } catch {
            if (
              !closed &&
              !["complete", "interrupted", "failed"].includes(
                statuses[image.id],
              )
            ) {
              setStatus(image.id, "submitted", "状态未知，仍在等待");
            }
          }
        } catch (error) {
          if (!closed) {
            setStatus(image.id, "failed", `失败，可重试：${error.message}`);
          }
          if (objectUrl) releaseUrl(objectUrl);
        }
        processed++;
        summary();
      }
    } finally {
      busy = false;
      if (!closed) {
        status.textContent =
          "本批处理结束；等待/未知项尚未确认完成，失败项可重试";
        updateControls();
        summary();
      }
    }
  });
  try {
    route = parseGalleryRoute(location.search);
    let capture;
    const fixtureResources = new Set([
      "product-front.svg",
      "product-detail.svg",
      "product-angle.svg",
    ].map((name) => chrome.runtime.getURL("fixtures/" + name)));
    if (route.mode === "demo") {
      $("demo-notice").hidden = false;
      const { createFixtureCapture } = await import("./src/fixture-capture.js");
      capture = createFixtureCapture(chrome.runtime.getURL(""));
      if (capture.id !== "demo") throw new Error("演示数据无效");
      loadBlob = (url) => fixtureBlob(url, fixtureResources);
    } else {
      const response = await deadline(
        chrome.runtime.sendMessage({
          type: "gallery.get",
          sessionId: route.sessionId,
        }),
        15000,
        "读取会话超时，请重新打开图库",
      );
      if (!response?.ok) {
        const messages = {
          "invalid-request": "图库请求无效",
          "session-not-found": "会话不存在，请重新获取图片",
          "expired-session": "会话已过期，请重新获取图片",
          "internal-error": "会话读取失败，请重试",
        };
        throw new Error(messages[response?.code] || "会话响应无效");
      }
      capture = response.capture;
      if (capture?.id !== route.sessionId) throw new Error("会话不匹配");
      const { ALLOWED_IMAGE_ORIGINS } = await import("./src/site-policy.js");
      loadBlob = (url) => fetchImageBlob(url, ALLOWED_IMAGE_ORIGINS);
      for (const image of capture.images) {
        assertAllowedImageUrl(image.url, ALLOWED_IMAGE_ORIGINS);
      }
    }
    if (closed) return;
    if (
      capture?.version !== 1 || !Array.isArray(capture.images) ||
      capture.images.length > 80
    ) {
      throw new Error("图库数据无效");
    }
    if (
      route.mode === "demo" &&
      capture.images.some((i) => !fixtureResources.has(i.url))
    ) {
      throw new Error("演示图片不在固定资源列表中");
    }
    images = capture.images;
    $("capture-title").textContent = String(capture.title || "商品图片").slice(
      0,
      160,
    );
    selected = selectAll(images.map((i) => i.id));
    for (const [index, image] of images.entries()) {
      const card = document.createElement("article");
      card.className = "card";
      const label = document.createElement("label");
      label.className = "card-label";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.setAttribute("aria-label", `选择第 ${index + 1} 张图片`);
      const title = document.createElement("span");
      title.textContent = image.alt ||
        `商品图 ${String(index + 1).padStart(3, "0")}`;
      const preview = document.createElement("img");
      preview.alt = image.alt || `商品图 ${index + 1} 预览`;
      const dimensions = document.createElement("p");
      dimensions.className = "dimensions";
      dimensions.textContent = image.width && image.height
        ? `候选尺寸 ${image.width} × ${image.height} · 实际尺寸待解码`
        : "尺寸未知 · 等待预览";
      const state = document.createElement("p");
      state.className = "item-state";
      state.textContent = "待下载";
      label.append(checkbox, title);
      card.append(preview, label, dimensions, state);
      grid.append(card);
      cards.set(image.id, { checkbox, preview, dimensions, state });
      checkbox.addEventListener("change", () => {
        selected = toggleSelection(selected, image.id);
        updateControls();
      });
    }
    status.textContent = images.length
      ? "勾选需要的图片，导出为 PNG"
      : "没有可用图片，请返回重新获取";
    updateControls();
    // Previews and downloads share a single conversion queue, never parallel decode/canvas.
    for (const image of images) {
      if (closed) break;
      while (busy && !closed) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (closed) break;
      const card = cards.get(image.id);
      try {
        const png = await convert(image);
        if (closed) break;
        const url = URL.createObjectURL(png);
        urls.add(url);
        card.preview.onload = () => {
          card.dimensions.textContent =
            `实际尺寸 ${card.preview.naturalWidth} × ${card.preview.naturalHeight}`;
          releaseUrl(url);
        };
        card.preview.onerror = () => {
          card.dimensions.textContent = "预览失败 · 仍可尝试下载";
          releaseUrl(url);
        };
        card.preview.src = url;
      } catch {
        card.dimensions.textContent = "预览失败 · 实际尺寸未知，可尝试下载";
      }
    }
  } catch (error) {
    status.textContent = `无法打开图库：${error.message}`;
    updateControls();
  }
}

if (globalThis.document?.getElementById("gallery")) startGallery();
