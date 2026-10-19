import { normalizeImageCandidates } from "./src/image-candidates.js";
import {
  ALLOWED_IMAGE_ORIGINS,
  isSupportedProductPage,
} from "./src/site-policy.js";
import {
  getFreshSession,
  isFreshSession,
  limitSessionRecords,
  validateCaptureRequest,
  validateGalleryRequest,
} from "./src/session-protocol.js";

const prefix = "session:";
const extensionOrigin = chrome.runtime.getURL("").replace(/\/$/, "");
let pending = Promise.resolve();

async function handle(message, sender) {
  if (sender?.id !== chrome.runtime.id) {
    return { ok: false, code: "invalid-request" };
  }
  if (message?.type === "capture.create") {
    const validation = validateCaptureRequest(
      message,
      sender,
      isSupportedProductPage,
    );
    if (!validation.ok) return validation;
    const images = normalizeImageCandidates(
      message.candidates,
      validation.pageUrl,
      ALLOWED_IMAGE_ORIGINS,
    );
    if (!images.length) return { ok: false, code: "no-images" };
    const capture = {
      version: 1,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      pageUrl: validation.pageUrl,
      title: message.title,
      images,
    };
    const stored = await chrome.storage.session.get(null);
    const sessions = Object.fromEntries(
      Object.entries(stored).filter(([key]) => key.startsWith(prefix)),
    );
    sessions[prefix + capture.id] = capture;
    const { remove } = limitSessionRecords(sessions, capture.createdAt);
    await chrome.storage.session.set({ [prefix + capture.id]: capture });
    if (remove.length) await chrome.storage.session.remove(remove);
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL("gallery.html?sessionId=" + capture.id),
      });
    } catch (error) {
      await chrome.storage.session.remove(prefix + capture.id);
      throw error;
    }
    return { ok: true, sessionId: capture.id };
  }
  if (
    sender.frameId !== 0 ||
    !validateGalleryRequest(message, sender.url, extensionOrigin)
  ) {
    return { ok: false, code: "invalid-request" };
  }
  const key = prefix + message.sessionId;
  if (message.type === "gallery.release") {
    await chrome.storage.session.remove(key);
    return { ok: true };
  }
  const stored = await chrome.storage.session.get(null);
  const session = stored[key];
  const { remove } = limitSessionRecords(
    Object.fromEntries(
      Object.entries(stored).filter(([key]) => key.startsWith(prefix)),
    ),
    Date.now(),
  );
  if (remove.length) await chrome.storage.session.remove(remove);
  if (!session) return { ok: false, code: "session-not-found" };
  if (!isFreshSession(session, Date.now())) {
    return { ok: false, code: "expired-session" };
  }
  const capture = getFreshSession(session, message.sessionId, Date.now());
  return capture
    ? { ok: true, capture }
    : { ok: false, code: "session-not-found" };
}

// A worker-local queue makes storage read/modify/write operations serial.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const task = pending.then(() => handle(message, sender));
  pending = task.catch(() => {});
  task.then(respond, () => respond({ ok: false, code: "internal-error" }));
  return true;
});
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("gallery.html?demo=1") })
    .catch(() => {});
});
