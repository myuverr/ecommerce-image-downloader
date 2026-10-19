export function toggleSelection(selectedIds, imageId) {
  const next = new Set(selectedIds);
  if (next.has(imageId)) next.delete(imageId);
  else next.add(imageId);
  return next;
}
export function selectAll(imageIds) {
  return new Set(imageIds);
}
export function invertSelection(imageIds, selectedIds) {
  return new Set(imageIds.filter((id) => !selectedIds.has(id)));
}
export function pendingDownloadImages(images, selectedIds, statusById) {
  return images.filter((image) =>
    selectedIds.has(image.id) &&
    !["complete", "submitted", "in_progress"].includes(statusById[image.id])
  );
}
export function pngFilename(oneBasedIndex) {
  return `商品图_${String(oneBasedIndex).padStart(3, "0")}.png`;
}
