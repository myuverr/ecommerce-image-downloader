# Product Image Downloader

A Chrome Manifest V3 extension for collecting product images, selecting them in a gallery, and downloading PNG files. No build step or runtime dependencies.

## Features

- Capture image candidates from supported product pages.
- Preview images, select all, or invert your selection.
- Download selected images as PNG files with completion status and retries for failed downloads.
- Open a built-in sample gallery from the toolbar icon.

## Supported sites

**Suning (experimental):** product pages at `https://product.suning.com/<shop-id>/<product-id>.html`, with images from `https://imgservice.suning.cn`.

Login requirements and page restrictions may prevent extraction. Support is experimental and may not work on every product page. Other platforms, including JD and Taobao/Tmall, are not supported.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` directory.

## Usage

1. Open a supported product page and click **获取图片** (Get images).
2. In the gallery, check the images you want. Use **全选** (Select all) or **反选** (Invert selection) as needed.
3. Click **批量下载 PNG** (Download selected PNGs). Files use names such as `商品图_001.png`; Chrome may add a suffix for duplicates.

Keep the gallery open to track download completion. Failed or interrupted downloads can be retried.

Click the extension's toolbar icon to open the **Sample gallery**. These bundled sample images are not captured from a website.

## Development

Requires [Deno](https://deno.com/).

```sh
deno test tests/
deno lint extension tests
```

## License

[ISC](LICENSE)
