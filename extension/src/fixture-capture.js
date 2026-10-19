export function createFixtureCapture(extensionBaseUrl) {
  const assets = [
    ["product-front.svg", "正面 · 本地示例", 640, 640],
    ["product-detail.svg", "细节 · 本地示例", 640, 800],
    ["product-angle.svg", "侧面 · 本地示例", 800, 640],
  ];
  return {
    version: 1,
    id: "demo",
    createdAt: Date.now(),
    pageUrl: new URL("gallery.html?demo=1", extensionBaseUrl).href,
    title: "Sample gallery",
    images: assets.map(([name, alt, width, height], index) => ({
      id: "image-" + String(index + 1).padStart(3, "0"),
      url: new URL("fixtures/" + name, extensionBaseUrl).href,
      alt,
      width,
      height,
    })),
  };
}
