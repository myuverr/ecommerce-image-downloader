import { deepStrictEqual as eq } from "node:assert/strict";
import {
  invertSelection,
  pendingDownloadImages,
  pngFilename,
  selectAll,
  toggleSelection,
} from "../extension/src/gallery-state.js";

Deno.test("toggleSelectionReturnsNewSets", () => {
  const original = new Set();
  const selected = toggleSelection(original, "image-001");
  eq([...selected], ["image-001"]);
  eq([...original], []);
  eq([...toggleSelection(selected, "image-001")], []);
  eq([...selected], ["image-001"]);
});
Deno.test("selectAllAndInvertSelection", () => {
  eq([...selectAll(["image-001", "image-002"])], ["image-001", "image-002"]);
  eq([...invertSelection(["image-001", "image-002"], new Set(["image-001"]))], [
    "image-002",
  ]);
});
Deno.test("pendingDownloadImagesSkipsCompleteAndAllowsRetry", () => {
  const images = [
    "complete",
    "interrupted",
    "failed",
    "submitted",
    "in_progress",
    "pending",
    "missing",
    "unselected",
  ].map((id) => ({ id }));
  eq(
    pendingDownloadImages(
      images,
      new Set(images.slice(0, -1).map((i) => i.id)),
      {
        complete: "complete",
        interrupted: "interrupted",
        failed: "failed",
        submitted: "submitted",
        in_progress: "in_progress",
        pending: "pending",
      },
    ).map((i) => i.id),
    ["interrupted", "failed", "pending", "missing"],
  );
});
Deno.test("pngFilenamePadsWithoutTruncating", () => {
  eq(pngFilename(1), "商品图_001.png");
  eq(pngFilename(1000), "商品图_1000.png");
});
