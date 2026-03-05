/**
 * FUND-10: Image/asset optimization — lazy loading, responsive images,
 * WebP detection, and placeholder generation.
 */

/**
 * FUND-10: Check if the browser supports WebP format.
 */
let webpSupported: boolean | null = null;
export function supportsWebP(): Promise<boolean> {
  if (webpSupported !== null) return Promise.resolve(webpSupported);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { webpSupported = img.width > 0; resolve(webpSupported); };
    img.onerror = () => { webpSupported = false; resolve(false); };
    img.src = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
  });
}

/**
 * FUND-10: Generate a tiny SVG placeholder for images (blur-up technique).
 */
export function generatePlaceholder(width: number, height: number, color = "#e5e7eb"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect fill="${color}" width="100%" height="100%"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * FUND-10: Intersection Observer based lazy loading for images.
 * Returns a cleanup function.
 */
export function setupLazyImages(
  root?: HTMLElement | null,
  rootMargin = "200px 0px",
): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const img = entry.target as HTMLImageElement;
        const src = img.dataset.src;
        const srcset = img.dataset.srcset;
        if (src) img.src = src;
        if (srcset) img.srcset = srcset;
        img.removeAttribute("data-src");
        img.removeAttribute("data-srcset");
        img.classList.remove("lazy");
        observer.unobserve(img);
      }
    },
    { root, rootMargin },
  );

  const images = (root ?? document).querySelectorAll<HTMLImageElement>("img.lazy[data-src]");
  images.forEach((img) => observer.observe(img));

  return () => observer.disconnect();
}

/**
 * FUND-10: Compress an image file before upload using Canvas.
 * Returns a Blob with the compressed image.
 */
export async function compressImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1080,
  quality = 0.85,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if needed
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context unavailable")); return; }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Image compression failed"));
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * FUND-10: Get optimal image dimensions for a container.
 */
export function getOptimalImageSize(
  containerWidth: number,
  devicePixelRatio = window.devicePixelRatio ?? 1,
): { width: number; quality: number } {
  const physicalWidth = Math.round(containerWidth * Math.min(devicePixelRatio, 2));
  const quality = physicalWidth > 1200 ? 0.8 : 0.85;
  return { width: physicalWidth, quality };
}

/**
 * FUND-10: Preload critical images (above-the-fold).
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = src;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to preload: ${src}`));
    document.head.appendChild(link);
  });
}
