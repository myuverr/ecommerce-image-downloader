// Experimental Suning support is restricted to these page and image origins.
export const SUPPORTED_PAGE_MATCHES = ["https://product.suning.com/*"];
export const SUPPORTED_PAGE_ORIGINS = ["https://product.suning.com"];
export const ALLOWED_IMAGE_ORIGINS = ["https://imgservice.suning.cn"];

export function matchesProductPageUrl(rawUrl, { origin, pathPrefix }) {
  if (typeof rawUrl !== "string" || rawUrl.length > 2048) return false;
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && url.origin === origin &&
      !url.username && !url.password && url.pathname.startsWith(pathPrefix);
  } catch {
    return false;
  }
}
export function isSupportedProductPage(rawUrl) {
  if (
    !matchesProductPageUrl(rawUrl, {
      origin: SUPPORTED_PAGE_ORIGINS[0],
      pathPrefix: "/",
    })
  ) return false;
  return /^\/[0-9]+\/[0-9]+\.html$/.test(new URL(rawUrl).pathname);
}
