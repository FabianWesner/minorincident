import { writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { samplePairs, routesOf } from '../../tools/scenelab/contrast';

const luminance = (r: number, g: number, b: number) => {
  const linear = (v: number) => v / 255 <= .04045 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4;
  return .2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b);
};
const ratio = (a: number, b: number) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
/** Read the actual mission camera/pose. No lit-floor substitution or scene stand-in. */
export async function l9Readability(page: Page, path: string, courier: boolean) {
  const contrast = { district: 'D-CROSSING', stepM: 2 }, half = routesOf(contrast).halfWidthM;
  const points = await page.evaluate(async ({ pairs, half }) => {
    const a = window.__SS__!; await a.screenshotReady();
    const p = a.getState().player!.transform, car = a.query({}).find(e => e.vehicle?.driver === 1)?.transform;
    const project = (x: number, z: number) => a.camera.project(x, .04, z);
    return {
      route: pairs.filter(([x, z]) => !car || Math.hypot(x - car.x, z - car.z) > 8).map(([x, z, nx, nz, side]) => ({
        at: [x, z], road: [0, -.5, .5, -.9, .9].map(t => project(x + nx * half * t, z + nz * half * t)),
        verge: project(x + nx * (half + 1.5) * side, z + nz * (half + 1.5) * side),
      })),
      ring: Array.from({ length: 16 }, (_, i) => project(p.x + 2 * Math.cos(i * Math.PI / 8), p.z + 2 * Math.sin(i * Math.PI / 8))),
      tick: a.getState().tick, camera: a.getState().render.camera,
    };
  }, { pairs: samplePairs(contrast), half });
  const image = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${path}.png` }));
  const patch = (p: number[]) => {
    if (Math.abs(p[0]) > .94 || Math.abs(p[1]) > .94 || p[2] < -1 || p[2] > 1) return null;
    const x = Math.round((p[0] + 1) * image.width / 2), y = Math.round((1 - p[1]) * image.height / 2);
    let sum = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const i = ((y + dy) * image.width + x + dx) * 4;
      sum += luminance(image.data[i], image.data[i + 1], image.data[i + 2]);
    }
    return sum / 25;
  };
  const pairs = points.route.flatMap(p => {
    const road = p.road.map(patch).filter((v): v is number => v !== null), verge = patch(p.verge);
    return road.length === 5 && verge !== null ? [{ at: p.at, road: road.reduce((s, v) => s + v, 0) / road.length, verge }] : [];
  });
  const values = pairs.map(p => ratio(p.road, p.verge)).sort((a, b) => a - b);
  let playerPixels = 0, playerSum = 0, playerContrast: number | null = null;
  if (courier) {
    await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: true }); await window.__SS__!.screenshotReady(); });
    const mask = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${path}-mask.png` }));
    await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: false }); await window.__SS__!.screenshotReady(); });
    const inside = (i: number) => mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240;
    for (let i = 0; i < mask.data.length; i += 4) if (inside(i)) { playerPixels++; playerSum += luminance(image.data[i], image.data[i + 1], image.data[i + 2]); }
    const ring = points.ring.filter(p => {
      const x = Math.round((p[0] + 1) * mask.width / 2), y = Math.round((1 - p[1]) * mask.height / 2);
      return !inside((y * mask.width + x) * 4);
    }).map(patch).filter((v): v is number => v !== null);
    if (playerPixels && ring.length >= 8) playerContrast = ratio(playerSum / playerPixels, ring.reduce((s, v) => s + v, 0) / ring.length);
  }
  const result = { ...points, pairs, viewingFlare: .05, navigation: values[Math.floor(values.length / 2)] ?? null, playerPixels, playerContrast };
  writeFileSync(`${path}.json`, JSON.stringify(result, null, 2));
  return result;
}
