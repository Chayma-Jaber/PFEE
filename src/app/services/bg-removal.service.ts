import { Injectable } from '@angular/core';

/**
 * Client-side white-background removal for product photos.
 *
 * Why this exists
 * ───────────────
 * Studio Look needs garments to render as if they're worn on the body, but
 * Barsha's product CDN serves photos with white studio backgrounds. Showing
 * those unmodified produces visible white rectangles around each garment.
 * Using `mix-blend-mode: multiply` works but darkens colours by the body
 * tone underneath — wrong with dark skin tones.
 *
 * The real fix is to give the renderer an actually-transparent PNG. We can
 * do that in the browser by drawing the image to a canvas, walking the pixel
 * buffer, and zeroing alpha for near-white pixels (with a small feathered
 * edge so the cutout doesn't look paper-jagged).
 *
 * Constraints
 * ───────────
 * Requires the image origin to allow CORS (Access-Control-Allow-Origin).
 * If it doesn't, the canvas becomes "tainted" and getImageData throws — we
 * catch that and fall back to the original URL (callers will then have to
 * use blend-mode multiply as a second-best option). All results are cached
 * by URL so a product image is processed at most once per session.
 */
@Injectable({ providedIn: 'root' })
export class BgRemovalService {
  private cache = new Map<string, string>();
  private inflight = new Map<string, Promise<string>>();

  /**
   * Returns a data: URL with the white background removed, or the original
   * URL if cross-origin restrictions or any other error blocks processing.
   *
   * @param threshold  Pixels above this RGB value (each channel) are made fully transparent. Default 240.
   * @param soften     Pixels in `(threshold-soften, threshold)` get a feathered alpha. Default 18.
   */
  remove(url: string, threshold = 240, soften = 18): Promise<string> {
    if (!url) return Promise.resolve(url);
    const cached = this.cache.get(url);
    if (cached) return Promise.resolve(cached);
    const ongoing = this.inflight.get(url);
    if (ongoing) return ongoing;

    const work = new Promise<string>((resolve) => {
      const img = new Image();
      // Crossorigin must be set BEFORE src so the request includes proper headers.
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';

      const fallback = () => {
        // Either CORS blocked, or load failed. Cache the original so we don't keep retrying.
        this.cache.set(url, url);
        resolve(url);
      };

      img.onload = () => {
        try {
          // Cap working size — keeps memory predictable on huge product photos.
          const maxDim = 800;
          const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));

          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return fallback();

          ctx.drawImage(img, 0, 0, w, h);
          let imageData: ImageData;
          try {
            imageData = ctx.getImageData(0, 0, w, h);
          } catch {
            // Tainted canvas — image origin doesn't allow CORS reads.
            return fallback();
          }
          const data = imageData.data;

          const lower = threshold - soften;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const minChannel = r < g ? (r < b ? r : b) : (g < b ? g : b);
            if (minChannel >= threshold) {
              // Fully white-ish → fully transparent.
              data[i + 3] = 0;
            } else if (minChannel >= lower) {
              // Edge feather — interpolate alpha from 0 (at threshold) to 255 (at threshold − soften).
              const t = (threshold - minChannel) / soften;     // 0..1
              data[i + 3] = Math.round(255 * t);
            }
            // Else: keep original alpha.
          }
          ctx.putImageData(imageData, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          this.cache.set(url, dataUrl);
          resolve(dataUrl);
        } catch {
          fallback();
        }
      };
      img.onerror = fallback;
      img.src = url;
    });

    this.inflight.set(url, work);
    work.finally(() => this.inflight.delete(url));
    return work;
  }
}
