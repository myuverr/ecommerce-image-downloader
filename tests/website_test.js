import { deepStrictEqual as eq, ok, strictEqual } from "node:assert/strict";
import {
  DOWNLOAD_URL,
  RELEASE_URL,
  resolveLanguage,
  SITE_COPY,
} from "../docs/site.js";

Deno.test("resolveLanguage defaults to English", () => {
  eq(resolveLanguage(), "en");
  eq(resolveLanguage(""), "en");
  eq(resolveLanguage("?lang=en"), "en");
});

Deno.test("resolveLanguage recognizes the Simplified Chinese query value", () => {
  eq(resolveLanguage("?lang=zh-hans"), "zh-hans");
  eq(resolveLanguage("?from=home&lang=zh-hans"), "zh-hans");
});

Deno.test("resolveLanguage falls back to English for other values", () => {
  for (
    const search of [
      "?lang=zh",
      "?lang=fr",
      "?lang=ZH-HANS",
      "?other=zh-hans",
    ]
  ) {
    eq(resolveLanguage(search), "en");
  }
});

Deno.test("site copy has complete English and Simplified Chinese entries", () => {
  const expectedKeys = [
    "skipLink",
    "brandName",
    "pageTitle",
    "metaDescription",
    "languageLabel",
    "englishLabel",
    "chineseLabel",
    "heroEyebrow",
    "heroTitle",
    "heroDescription",
    "downloadCta",
    "releaseLink",
    "versionNote",
    "illustrationLabel",
    "visualTag",
    "featuresEyebrow",
    "featuresTitle",
    "featuresIntro",
    "featureCaptureTitle",
    "featureCaptureBody",
    "featureSelectTitle",
    "featureSelectBody",
    "featureDownloadTitle",
    "featureDownloadBody",
    "installEyebrow",
    "installTitle",
    "installIntro",
    "stepDownloadTitle",
    "stepDownloadBody",
    "stepExtractTitle",
    "stepExtractBody",
    "stepLoadTitle",
    "stepLoadBody",
    "supportTitle",
    "supportBody",
    "supportNote",
    "repositoryLink",
    "footerNote",
  ].sort();

  eq(Object.keys(SITE_COPY.en).sort(), expectedKeys);
  eq(Object.keys(SITE_COPY["zh-hans"]).sort(), expectedKeys);
  for (const language of ["en", "zh-hans"]) {
    for (const [key, value] of Object.entries(SITE_COPY[language])) {
      ok(value.trim(), `${language}.${key} should not be empty`);
    }
  }
});

Deno.test("release URL constants point to the published v0.1.0 asset and release page", () => {
  strictEqual(
    DOWNLOAD_URL,
    "https://github.com/myuverr/ecommerce-image-downloader/releases/download/v0.1.0/ecommerce-image-downloader-0.1.0.zip",
  );
  strictEqual(
    RELEASE_URL,
    "https://github.com/myuverr/ecommerce-image-downloader/releases/tag/v0.1.0",
  );
});
