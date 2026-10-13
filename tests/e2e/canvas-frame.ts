import type { Page } from '@playwright/test';

/** Read the presented game canvas itself; DOM menus and labels cannot satisfy this gate.
 * Spatial coverage also rejects a cleared frame containing only a small health bar. */
export async function canvasFrame(page: Page) {
  return page.evaluate(async () => {
    await window.__SS__!.screenshotReady();
    const canvas = document.querySelector('canvas')!;
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const context = copy.getContext('2d')!; context.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    const grid = 8, sums = Array.from({ length: grid * grid }, () => [0, 0, 0]);
    const squares = sums.map(() => [0, 0, 0]), counts = sums.map(() => 0);
    for (let y = 0; y < copy.height; y++) for (let x = 0; x < copy.width; x++) {
      const tile = Math.min(grid - 1, Math.floor(y * grid / copy.height)) * grid + Math.min(grid - 1, Math.floor(x * grid / copy.width));
      const offset = (y * copy.width + x) * 4; counts[tile]++;
      for (let c = 0; c < 3; c++) { const value = pixels[offset + c]; sums[tile][c] += value; squares[tile][c] += value * value; }
    }
    const count = copy.width * copy.height;
    const mean = [0, 1, 2].map(c => sums.reduce((s, tile) => s + tile[c], 0) / count);
    const variance = Math.max(...mean.map((m, c) => squares.reduce((s, tile) => s + tile[c], 0) / count - m * m));
    const tileVariances = counts.map((n, i) => n ? Math.max(...sums[i].map((s, c) => squares[i][c] / n - (s / n) ** 2)) : 0);
    return { width: copy.width, height: copy.height, mean, variance, variedTiles: tileVariances.filter(v => v > 1).length, tiles: grid * grid };
  });
}

export const canvasFrameLimits = { varianceMin: 1, variedTilesMin: 8 } as const;
export function canvasFrameChecks(frame: Awaited<ReturnType<typeof canvasFrame>>, label = 'canvas') {
  return [
    { name: `${label}.varianceMin`, pass: Number.isFinite(frame.variance) && frame.variance > canvasFrameLimits.varianceMin, value: frame.variance, limit: canvasFrameLimits.varianceMin },
    { name: `${label}.variedTilesMin`, pass: frame.variedTiles >= canvasFrameLimits.variedTilesMin, value: frame.variedTiles, limit: canvasFrameLimits.variedTilesMin },
  ];
}
