const COMPRESSIBLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const isCompressibleImage = (file) =>
  COMPRESSIBLE_IMAGE_TYPES.has(file?.type);

const loadImage = async (file) => {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not decode image"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

const toBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Re-encodes an image at a bounded size. The original file is returned whenever
 * re-encoding would not actually save bytes, so the file a scientist sees is
 * never larger than the one they dropped.
 */
export const compressImageFile = async (
  file,
  { maxDimension = 1600, quality = 0.82 } = {},
) => {
  const unchanged = { blob: file, changed: false };
  if (!isCompressibleImage(file)) return unchanged;

  let source;
  try {
    source = await loadImage(file);
  } catch {
    return unchanged;
  }

  const { width, height } = source;
  if (!width || !height) return unchanged;

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) return unchanged;
  context.drawImage(source, 0, 0, targetWidth, targetHeight);

  // PNG ignores the quality argument, so its only saving comes from downscaling.
  const blob = await toBlob(canvas, file.type, quality);
  if (!blob || blob.size >= file.size) return unchanged;

  return { blob, changed: true };
};
