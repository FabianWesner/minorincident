import type { Page } from '@playwright/test';

/** Abrupt black/white edges in an isolated actor crop. Uses presented canvas pixels,
 * so malformed GPU geometry is caught even when rig/triangle counters are valid.
 * `silhouetteRoughness`: outline pixels / sqrt(area) of the dark body mask (pixels clearly darker than the crop's border ring).
 * A compact hulking figure stays low; hair-lock spikes, sliver islands and perforation raise it sharply (the old LOD2 Alpha). */
export function edgeNoise(data: ArrayLike<number>, width: number, height: number, rect: readonly number[]) {
  const [x0, y0, x1, y1] = rect.map((v, i) => Math.round(v * (i % 2 ? height : width)));
  const luma = (i: number) => .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2];
  let edges = 0, extremeEdges = 0;
  for (let y = Math.max(0, y0); y < Math.min(height - 1, y1); y++) for (let x = Math.max(0, x0); x < Math.min(width - 1, x1); x++) {
    const i = (y * width + x) * 4, a = luma(i);
    for (const j of [i + 4, i + width * 4]) {
      const b = luma(j);
      if (Math.abs(a - b) > 25) edges++;
      if (Math.min(a, b) < 60 && Math.max(a, b) > 145 && Math.abs(a - b) > 110) extremeEdges++;
    }
  }
  return { edges, extremeEdges, extremeEdgeShare: edges ? extremeEdges / edges : 0, ...silhouette(luma, width, height, x0, y0, x1, y1) };
}

function silhouette(luma: (i: number) => number, width: number, height: number, x0: number, y0: number, x1: number, y1: number) {
  x0 = Math.max(1, x0); y0 = Math.max(1, y0); x1 = Math.min(width - 1, x1); y1 = Math.min(height - 1, y1);
  const w = x1 - x0, h = y1 - y0;
  if (w <= 2 || h <= 2) return { silhouetteArea: 0, silhouetteOutline: 0, silhouetteRoughness: 0 };
  const ring: number[] = [];
  for (let x = x0; x < x1; x += 3) ring.push(luma((y0 * width + x) * 4), luma(((y1 - 1) * width + x) * 4));
  for (let y = y0; y < y1; y += 3) ring.push(luma((y * width + x0) * 4), luma((y * width + x1 - 1) * 4));
  ring.sort((a, b) => a - b);
  const limit = ring[ring.length >> 1] * .7;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = luma(((y0 + y) * width + x0 + x) * 4) < limit ? 1 : 0;
  let area = 0, outline = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!mask[i]) continue;
    area++; if (!mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w]) outline++;
  }
  return { silhouetteArea: area, silhouetteOutline: outline, silhouetteRoughness: area ? outline / Math.sqrt(area) : 0 };
}

export async function canvasEdgeNoise(page: Page, rect: readonly number[]) {
  const frame = await page.evaluate(async () => {
    await window.__SS__!.screenshotReady(); // a WebGL canvas reads back blank outside the frame that presented it
    const canvas = document.querySelector('canvas')!, copy = document.createElement('canvas');
    copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d')!; ctx.drawImage(canvas, 0, 0);
    return { data: Array.from(ctx.getImageData(0, 0, copy.width, copy.height).data), width: copy.width, height: copy.height };
  });
  return edgeNoise(frame.data, frame.width, frame.height, rect);
}
