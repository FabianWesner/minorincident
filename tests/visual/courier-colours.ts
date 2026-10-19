import type { Page } from '@playwright/test';
import { PNG } from 'pngjs';

/** HSV of an 8-bit display pixel: hue in degrees, saturation/value in 0..1. */
export function hsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return [(h + 360) % 360, max ? d / max : 0, max / 255];
}
const luminance = (r: number, g: number, b: number) => {
  const c = [r, g, b].map(v => v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
};
/** Daylight classes of the courier's identity colours (both outfits). Hair: auburn/red-brown, darker than skin.
 * Outfit: the saturated teal and yellow/orange clothing swatches. Skin: peach. */
export function daylightClass(r: number, g: number, b: number): 'hair' | 'outfit' | 'skin' | null {
  const [h, s, v] = hsv(r, g, b);
  if ((h < 32 || h > 345) && s >= .45 && v >= .18 && v <= .62) return 'hair';
  if (s >= .5 && v >= .35 && ((h >= 160 && h <= 200) || (h >= 32 && h <= 60))) return 'outfit';
  if (h >= 12 && h <= 40 && s >= .18 && s < .5 && v >= .6) return 'skin';
  return null;
}
const circularMean = (hues: number[]) => {
  const x = hues.reduce((a, h) => a + Math.cos(h * Math.PI / 180), 0), y = hues.reduce((a, h) => a + Math.sin(h * Math.PI / 180), 0);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};
export interface ColourStats { pixels: number; hair: { pixels: number; hue: number; saturation: number }; outfit: { pixels: number; saturation: number }; skin: { pixels: number; hue: number; saturation: number } }
/** Classes come from the daylight frame (same pose and camera); the stats are read from `image`. */
export function courierColourStats(image: PNG, day: PNG, mask: PNG): ColourStats {
  const hair: number[][] = [], outfit: number[] = [], skin: number[][] = [];
  let pixels = 0;
  for (let i = 0; i < mask.data.length; i += 4) {
    if (mask.data[i] <= 240 || mask.data[i + 1] >= 20 || mask.data[i + 2] <= 240) continue;
    pixels++;
    const kind = daylightClass(day.data[i], day.data[i + 1], day.data[i + 2]);
    if (!kind) continue;
    const c = hsv(image.data[i], image.data[i + 1], image.data[i + 2]);
    if (kind === 'hair') hair.push(c); else if (kind === 'skin') skin.push(c); else outfit.push(c[1]);
  }
  const mean = (v: number[]) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  return { pixels,
    hair: { pixels: hair.length, hue: circularMean(hair.map(c => c[0])), saturation: mean(hair.map(c => c[1])) },
    outfit: { pixels: outfit.length, saturation: mean(outfit) },
    skin: { pixels: skin.length, hue: circularMean(skin.map(c => c[0])), saturation: mean(skin.map(c => c[1])) } };
}
/** Signed hue distance in degrees. */
export const hueDelta = (a: number, b: number) => ((a - b + 540) % 360) - 180;
/** The colour guard: red-brown hair (hue -10..35 deg, saturation >= 80 % of daylight, i.e. not mint/grey/pastel) and outfit saturation >= 70 % of daylight. */
export function colourFailures(night: ColourStats, day: ColourStats): string[] {
  const failures: string[] = [];
  if (day.hair.pixels < 15 || day.outfit.pixels < 20) failures.push(`daylight reference lacks classes (hair ${day.hair.pixels}px, outfit ${day.outfit.pixels}px)`);
  const hue = night.hair.hue > 180 ? night.hair.hue - 360 : night.hair.hue;
  if (!(hue >= -10 && hue <= 35) || night.hair.saturation < .3) failures.push(`hair hue ${night.hair.hue.toFixed(1)} deg / saturation ${night.hair.saturation.toFixed(2)} is not red-brown`);
  if (night.hair.saturation < .8 * day.hair.saturation) failures.push(`hair saturation ${night.hair.saturation.toFixed(3)} < 80% of daylight ${day.hair.saturation.toFixed(3)}`);
  if (night.outfit.saturation < .7 * day.outfit.saturation) failures.push(`outfit saturation ${night.outfit.saturation.toFixed(3)} < 70% of daylight ${day.outfit.saturation.toFixed(3)}`);
  return failures;
}

/** Night frame, courier ID mask and a daylight frame of the same pose/camera (preset swapped, then restored). */
export async function courierFrames(page: Page, dayPreset = 'L2') {
  const canvas = page.locator('canvas').first();
  await page.evaluate(() => window.__SS__!.screenshotReady());
  const image = PNG.sync.read(await canvas.screenshot());
  await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: true }); await window.__SS__!.screenshotReady(); });
  const mask = PNG.sync.read(await canvas.screenshot());
  const preset = await page.evaluate(async dayPreset => {
    const a = window.__SS__!, preset = a.perf().lighting!.preset;
    a.settings.set({ idPass: false, timeOfDay: dayPreset as never }); await a.screenshotReady();
    return preset;
  }, dayPreset);
  const day = PNG.sync.read(await canvas.screenshot());
  await page.evaluate(async preset => { const a = window.__SS__!; a.settings.set({ timeOfDay: preset as never }); await a.screenshotReady(); }, preset);
  return { image, mask, day, preset };
}
/** Mean courier luminance over the mask (for the daylight reference's own contrast/brightness). */
export function maskLuminance(image: PNG, mask: PNG) {
  let sum = 0, n = 0;
  for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) { sum += luminance(image.data[i], image.data[i + 1], image.data[i + 2]); n++; }
  return n ? sum / n : 0;
}
