(() => {
  if (
    globalThis.top !== globalThis ||
    location.origin !== "https://product.suning.com" ||
    !/^\/[0-9]+\/[0-9]+\.html$/.test(location.pathname)
  ) return;

  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;right:20px;bottom:24px;z-index:2147483647";
  const shadow = host.attachShadow({ mode: "closed" });
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "获取图片";
  button.style.cssText =
    "font:16px sans-serif;padding:12px 20px;border:2px solid #fff;border-radius:24px;background:#205c50;color:#fff;cursor:pointer;box-shadow:0 2px 12px #0005";
  shadow.append(button);
  document.documentElement.append(host);

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "正在获取…";
    try {
      const candidates = [];
      const add = (value, kind, alt, dimensions = {}) => {
        if (
          typeof value !== "string" || !value || value.length > 2048 ||
          candidates.length >= 300
        ) return;
        candidates.push({
          value,
          kind,
          alt: String(alt || "").slice(0, 160),
          ...dimensions,
        });
      };
      const walker = document.createTreeWalker(
        document.documentElement,
        NodeFilter.SHOW_ELEMENT,
      );
      let node;
      let visited = 0;
      while (
        visited < 5000 && candidates.length < 300 && (node = walker.nextNode())
      ) {
        visited++;
        if (node.tagName === "IMG") {
          const current = node.currentSrc;
          const dimensions = {};
          if (node.naturalWidth > 0) dimensions.width = node.naturalWidth;
          if (node.naturalHeight > 0) dimensions.height = node.naturalHeight;
          add(current, "url", node.alt, dimensions);
          const src = node.getAttribute("src");
          // Only currentSrc has measured natural dimensions; alternate/lazy sources do not.
          add(src, "url", node.alt, src === current ? dimensions : {});
          for (
            const attr of [
              "data-src",
              "data-lazy-src",
              "data-original",
              "data-lazy-img",
            ]
          ) {
            add(node.getAttribute(attr), "url", node.alt);
          }
          add(node.getAttribute("srcset"), "srcset", node.alt);
        } else if (node.tagName === "SOURCE") {
          add(node.getAttribute("srcset"), "srcset", "");
        }
        if (node.getClientRects().length) {
          const style = getComputedStyle(node);
          if (style.display !== "none" && style.visibility !== "hidden") {
            const urls = style.backgroundImage.matchAll(
              /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g,
            );
            for (const match of urls) {
              add((match[1] ?? match[2] ?? match[3]).trim(), "url", "");
              if (candidates.length >= 300) break;
            }
          }
        }
      }
      const response = await chrome.runtime.sendMessage({
        type: "capture.create",
        title: document.title.slice(0, 160),
        candidates,
      });
      button.textContent = response?.ok
        ? "已打开图库"
        : response?.code === "no-images"
        ? "未找到可用图片"
        : "获取失败，请重试";
    } catch {
      button.textContent = "获取失败，请重试";
    } finally {
      button.disabled = false;
    }
  });
})();
