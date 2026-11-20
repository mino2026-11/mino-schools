/**
 * Client-side School Logo Image Processor
 * Converts uploaded PNG/JPEG/WEBP/SVG files into crisp, lightweight Data URLs
 * suitable for immediate display across all school dashboards and persistence.
 */

export async function processSchoolLogoFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select a valid image file (PNG, JPG, WEBP, or SVG).');
  }

  const maxRawBytes = 5 * 1024 * 1024; // 5 MB input limit
  if (file.size > maxRawBytes) {
    throw new Error('Image file is too large. Please choose a logo under 5 MB.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  // Preserve vector SVGs directly
  if (file.type === 'image/svg+xml') {
    return rawDataUrl;
  }

  // Resize raster logos cleanly to max 320x320 while preserving transparency
  return await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 320;
      let { width, height } = img;

      if (width <= maxDim && height <= maxDim && file.size <= 180 * 1024) {
        resolve(rawDataUrl);
        return;
      }

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}
