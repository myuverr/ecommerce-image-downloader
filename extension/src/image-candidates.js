const MAX_RAW_CANDIDATES = 300;
const MAX_GALLERY_IMAGES = 80;
const MAX_URL_LENGTH = 2048;
const MAX_ALT_LENGTH = 160;
const MIN_KNOWN_SIDE = 80;

function isWhitespace(character) {
  return /\s/.test(character);
}

function* parseSrcsetUrls(srcset) {
  let index = 0;

  while (index < srcset.length) {
    while (
      index < srcset.length &&
      (isWhitespace(srcset[index]) || srcset[index] === ",")
    ) {
      index++;
    }

    if (index >= srcset.length) {
      return;
    }

    const urlStart = index;
    while (index < srcset.length && !isWhitespace(srcset[index])) {
      index++;
    }

    let url = srcset.slice(urlStart, index);
    if (url.endsWith(",")) {
      url = url.replace(/,+$/, "");
      if (url) {
        yield url;
      }
      continue;
    }

    while (index < srcset.length) {
      while (index < srcset.length && isWhitespace(srcset[index])) {
        index++;
      }

      if (index >= srcset.length) {
        break;
      }

      if (srcset[index] === ",") {
        index++;
        break;
      }

      while (
        index < srcset.length &&
        !isWhitespace(srcset[index]) &&
        srcset[index] !== ","
      ) {
        index++;
      }

      if (index < srcset.length && srcset[index] === ",") {
        index++;
        break;
      }
    }

    yield url;
  }
}

function readDimension(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return value;
}

export function assertAllowedImageUrl(rawUrl, allowedOrigins) {
  if (typeof rawUrl !== "string" || rawUrl.length > MAX_URL_LENGTH) {
    throw new TypeError("Image URL must be a bounded string");
  }
  if (!Array.isArray(allowedOrigins)) {
    throw new TypeError("Allowed origins must be an array");
  }

  const url = new URL(rawUrl);
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    !allowedOrigins.includes(url.origin)
  ) {
    throw new TypeError("Image URL is not from an allowed HTTPS origin");
  }

  return url.href;
}

export function normalizeImageCandidates(rawCandidates, pageUrl, allowedOrigins) {
  if (!Array.isArray(rawCandidates)) {
    return [];
  }

  const images = [];
  const seenUrls = new Set();

  for (const candidate of rawCandidates.slice(0, MAX_RAW_CANDIDATES)) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate) ||
      (candidate.kind !== "url" && candidate.kind !== "srcset") ||
      typeof candidate.value !== "string"
    ) {
      continue;
    }

    const width = readDimension(candidate.width);
    const height = readDimension(candidate.height);
    if (width === undefined || height === undefined) {
      continue;
    }
    if (
      (width !== null && width < MIN_KNOWN_SIDE) ||
      (height !== null && height < MIN_KNOWN_SIDE)
    ) {
      continue;
    }

    const alt = typeof candidate.alt === "string"
      ? candidate.alt.slice(0, MAX_ALT_LENGTH)
      : "";
    const values = candidate.kind === "srcset"
      ? parseSrcsetUrls(candidate.value)
      : [candidate.value];

    for (const value of values) {
      if (!value || value.length > MAX_URL_LENGTH) {
        continue;
      }

      let url;
      try {
        url = assertAllowedImageUrl(
          new URL(value, pageUrl).href,
          allowedOrigins,
        );
      } catch {
        continue;
      }

      if (seenUrls.has(url)) {
        continue;
      }
      seenUrls.add(url);

      images.push({
        id: `image-${String(images.length + 1).padStart(3, "0")}`,
        url,
        alt,
        width,
        height,
      });
      if (images.length >= MAX_GALLERY_IMAGES) {
        return images;
      }
    }
  }

  return images;
}
