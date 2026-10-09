// Shrinks a photo before upload — phone camera photos are several MB and time out on slow field networks.
// Returns the original file if it's already small or can't be decoded.
export async function compressImage(file, { maxSize = 1280, quality = 0.8, skipBelowBytes = 300 * 1024 } = {}) {
  if (!file || !file.type?.startsWith('image/') || file.size <= skipBelowBytes) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
