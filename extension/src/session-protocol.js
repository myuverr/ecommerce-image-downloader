const TTL_MS = 20 * 60 * 1000;
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const bounded = (value, max) =>
  typeof value === "string" && value.length <= max;
const dimension = (value) =>
  value === undefined || value === null ||
  (typeof value === "number" && Number.isFinite(value) && value >= 0);

export function validateCaptureRequest(
  message,
  sender,
  isSupportedProductPage,
) {
  const invalid = { ok: false, code: "invalid-request" };
  if (
    !object(message) || message.type !== "capture.create" ||
    !bounded(message.title, 160) || !Array.isArray(message.candidates) ||
    Object.keys(message).some((key) =>
      !["type", "title", "candidates", "pageUrl"].includes(key)
    ) ||
    (message.pageUrl !== undefined && !bounded(message.pageUrl, 2048)) ||
    message.candidates.length > 300 || !sender?.tab ||
    !Number.isInteger(sender.tab.id) || sender.frameId !== 0 ||
    !bounded(sender.id, 128) || !sender.id ||
    !bounded(sender.url, 2048) || !isSupportedProductPage(sender.url)
  ) return invalid;
  let total = 0;
  for (const candidate of message.candidates) {
    if (
      !object(candidate) || !["url", "srcset"].includes(candidate.kind) ||
      !bounded(candidate.value, 2048) ||
      Object.keys(candidate).some((key) =>
        !["kind", "value", "alt", "width", "height"].includes(key)
      ) ||
      (candidate.alt !== undefined && !bounded(candidate.alt, 160)) ||
      !dimension(candidate.width) || !dimension(candidate.height)
    ) return invalid;
    total += candidate.value.length + (candidate.alt?.length ?? 0);
    if (total > 300 * (2048 + 160)) return invalid;
  }
  return { ok: true, pageUrl: sender.url };
}
export function isFreshSession(session, nowMs) {
  return object(session) && session.version === 1 &&
    Number.isFinite(nowMs) && typeof session.createdAt === "number" &&
    Number.isFinite(session.createdAt) && session.createdAt <= nowMs &&
    nowMs - session.createdAt <= TTL_MS;
}
export function isValidSessionId(value) {
  return typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    );
}
export function validateGalleryRequest(message, senderUrl, extensionOrigin) {
  if (
    !object(message) ||
    !["gallery.get", "gallery.release"].includes(message.type) ||
    !isValidSessionId(message.sessionId) || !bounded(senderUrl, 2048)
  ) return false;
  try {
    const url = new URL(senderUrl);
    // URL.origin is "null" for chrome-extension in some URL implementations.
    return url.protocol === "chrome-extension:" &&
      url.protocol + "//" + url.host === extensionOrigin &&
      url.pathname === "/gallery.html" && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function getFreshSession(storedSession, sessionId, nowMs) {
  return isValidSessionId(sessionId) && storedSession?.id === sessionId &&
      isFreshSession(storedSession, nowMs)
    ? storedSession
    : null;
}
export function limitSessionRecords(sessions, nowMs, maxSessions = 10) {
  const entries = Object.entries(sessions);
  // Insertion order breaks millisecond ties in favor of the newest capture.
  const fresh = entries.slice().reverse().filter(([, session]) =>
    isFreshSession(session, nowMs)
  )
    .sort((a, b) => b[1].createdAt - a[1].createdAt)
    .slice(0, Math.max(0, maxSessions));
  const keep = Object.fromEntries(fresh);
  return {
    keep,
    remove: entries.filter(([key]) => !Object.hasOwn(keep, key)).map(([key]) =>
      key
    ),
  };
}
