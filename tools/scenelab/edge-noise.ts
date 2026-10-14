import type { Page } from '@playwright/test';

/** Abrupt black/white edges in an isolated actor crop. Uses presented canvas pixels,
 * so malformed GPU geometry is caught even when rig/triangle counters are valid. */
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
  return { edges, extremeEdges, extremeEdgeShare: edges ? extremeEdges / edges : 0 };
}

export async function canvasEdgeNoise(page: Page, rect: readonly number[]) {
  const frame = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!, copy = document.createElement('canvas');
    copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d')!; ctx.drawImage(canvas, 0, 0);
    return { data: Array.from(ctx.getImageData(0, 0, copy.width, copy.height).data), width: copy.width, height: copy.height };
  });
  return edgeNoise(frame.data, frame.width, frame.height, rect);
}
