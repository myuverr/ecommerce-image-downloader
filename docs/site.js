export const DOWNLOAD_URL =
  "https://github.com/myuverr/ecommerce-image-downloader/releases/download/v0.1.0/ecommerce-image-downloader-0.1.0.zip";
export const RELEASE_URL =
  "https://github.com/myuverr/ecommerce-image-downloader/releases/tag/v0.1.0";

export const SITE_COPY = {
  en: {
    skipLink: "Skip to content",
    brandName: "Product Image Downloader",
    pageTitle: "Product Image Downloader — Select and save product images",
    metaDescription:
      "A lightweight Chrome extension for finding, selecting, and saving product images as PNG files.",
    languageLabel: "Choose language",
    englishLabel: "English",
    chineseLabel: "Simplified Chinese",
    heroEyebrow: "A simple workflow for product images",
    heroTitle: "Collect the product images you need.",
    heroDescription:
      "Find candidate images on a product page, choose the ones you want, and save them as PNG files.",
    downloadCta: "Download for Chrome",
    releaseLink: "View release",
    versionNote: "Version 0.1.0 · ZIP download",
    illustrationLabel: "Illustration of a product image gallery",
    visualTag: "Organized at a glance",
    featuresEyebrow: "Made for a focused task",
    featuresTitle: "From page to saved images",
    featuresIntro:
      "A straightforward way to collect, review, and download product images.",
    featureCaptureTitle: "Find image candidates",
    featureCaptureBody:
      "Collect image candidates from supported pages in one click.",
    featureSelectTitle: "Choose what to keep",
    featureSelectBody:
      "Preview the gallery and select only the images you need.",
    featureDownloadTitle: "Save as PNG",
    featureDownloadBody:
      "Download selected images as PNG files in a clear, simple workflow.",
    installEyebrow: "Get started",
    installTitle: "Install in three steps",
    installIntro:
      "Download the ZIP, then use Chrome's built-in extension settings.",
    stepDownloadTitle: "Download the ZIP",
    stepDownloadBody: "Save the v0.1.0 release file from the button above.",
    stepExtractTitle: "Extract the files",
    stepExtractBody: "Unzip the download to a folder you can find again.",
    stepLoadTitle: "Load the extension",
    stepLoadBody:
      "Open chrome://extensions, enable Developer mode, choose Load unpacked, and select the extracted extension/ folder.",
    supportTitle: "Platform support",
    supportBody:
      "Suning support is experimental. Login requirements or page restrictions may affect image collection.",
    supportNote:
      "Page behavior can change, so results may vary between product pages.",
    repositoryLink: "View the project on GitHub",
    footerNote: "A lightweight, no-build Chrome extension.",
  },
  "zh-hans": {
    skipLink: "跳转到正文",
    brandName: "商品图片下载器",
    pageTitle: "商品图片下载器 — 选择并保存商品图片",
    metaDescription:
      "一款轻量的 Chrome 扩展，可查找、选择商品图片并保存为 PNG 文件。",
    languageLabel: "选择语言",
    englishLabel: "英文",
    chineseLabel: "简体中文",
    heroEyebrow: "简洁的商品图片工作流",
    heroTitle: "轻松收集所需的商品图片。",
    heroDescription:
      "在商品页面查找图片候选项，选择需要的图片，并保存为 PNG 文件。",
    downloadCta: "下载 Chrome 扩展",
    releaseLink: "查看发布版本",
    versionNote: "版本 0.1.0 · ZIP 下载",
    illustrationLabel: "商品图片图库示意图",
    visualTag: "图片一目了然",
    featuresEyebrow: "专注做好一件事",
    featuresTitle: "从商品页面到保存图片",
    featuresIntro: "以简单直接的方式收集、预览并下载商品图片。",
    featureCaptureTitle: "查找图片候选项",
    featureCaptureBody: "在受支持的页面上一键收集图片候选项。",
    featureSelectTitle: "选择需要的图片",
    featureSelectBody: "预览图库，只选择你想保存的图片。",
    featureDownloadTitle: "保存为 PNG",
    featureDownloadBody: "以清晰、简单的流程将选中图片下载为 PNG 文件。",
    installEyebrow: "快速开始",
    installTitle: "三步完成安装",
    installIntro: "下载 ZIP 文件后，使用 Chrome 自带的扩展程序设置完成安装。",
    stepDownloadTitle: "下载 ZIP 文件",
    stepDownloadBody: "点击上方按钮，保存 v0.1.0 发布包。",
    stepExtractTitle: "解压文件",
    stepExtractBody: "将下载内容解压到一个容易找到的文件夹。",
    stepLoadTitle: "加载扩展程序",
    stepLoadBody:
      "打开 chrome://extensions，启用「开发者模式」，点击「加载已解压的扩展程序」，并选择解压后的 extension/ 文件夹。",
    supportTitle: "平台支持",
    supportBody:
      "Suning（苏宁）支持仍处于实验阶段。登录要求或页面限制可能影响图片收集。",
    supportNote: "页面可能发生变化，因此不同商品页的效果也可能有所不同。",
    repositoryLink: "在 GitHub 查看项目",
    footerNote: "轻量、无需构建步骤的 Chrome 扩展。",
  },
};

export function resolveLanguage(search = "") {
  return new URLSearchParams(search).get("lang") === "zh-hans"
    ? "zh-hans"
    : "en";
}

function applyLanguage(language) {
  const copy = SITE_COPY[language];
  document.documentElement.lang = language === "zh-hans" ? "zh-Hans" : "en";
  document.title = copy.pageTitle;
  document.querySelector('meta[name="description"]').content =
    copy.metaDescription;

  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = copy[element.dataset.i18n];
  }
  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", copy[element.dataset.i18nAriaLabel]);
  }
  for (const button of document.querySelectorAll("[data-language]")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.language === language),
    );
  }
}

function boot() {
  applyLanguage(resolveLanguage(globalThis.location.search));

  for (const button of document.querySelectorAll("[data-language]")) {
    button.addEventListener("click", () => {
      const language = button.dataset.language;
      applyLanguage(language);

      const url = new URL(globalThis.location.href);
      if (language === "en") {
        url.searchParams.delete("lang");
      } else {
        url.searchParams.set("lang", language);
      }
      globalThis.history.replaceState(
        globalThis.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    });
  }
}

if (typeof document !== "undefined") {
  boot();
}
