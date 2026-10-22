import { PNG } from 'pngjs';
import type { SceneSession } from './session';

/** alpha-white: colour statistics of the pixels the crowd view draws. `with`/`without` are the same frame with
 * and without the crowd (courier and HUD bars hidden in both), so only figure pixels (and their contact shadows)
 * differ. `whiteShare`: pale (luma > 175), unsaturated (< 0.2) share of those pixels: the hit-flash white mass.
 * `luma`: mean body luma (a flash or fallback white raises it against the live look).
 * `chroma`: mean saturation-weighted value (HSV s*v, 0..1) over the figure pixels; below `LOW_CHROMA` hue is noise.
 * `hue`: saturation-weighted mean hue in degrees (null when nothing is saturated). */
export function lookStats(withCrowd: ArrayLike<number>, withoutCrowd: ArrayLike<number>) {
  let pixels = 0, white = 0, luma = 0, sx = 0, sy = 0, weight = 0, r = 0, g = 0, b = 0;
  for (let i = 0; i < withCrowd.length; i += 4) {
    const R = withCrowd[i], G = withCrowd[i + 1], B = withCrowd[i + 2];
    if (Math.abs(R - withoutCrowd[i]) + Math.abs(G - withoutCrowd[i + 1]) + Math.abs(B - withoutCrowd[i + 2]) < 36) continue;
    pixels++; r += R; g += G; b += B; luma += .2126 * R + .7152 * G + .0722 * B;
    const max = Math.max(R, G, B), min = Math.min(R, G, B), saturation = max ? (max - min) / max : 0;
    if (.2126 * R + .7152 * G + .0722 * B > 175 && saturation < .2) white++;
    if (max === min) continue;
    const d = max - min, h = max === R ? ((G - B) / d + 6) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    const w = saturation * max / 255, angle = h * Math.PI / 3;
    sx += Math.cos(angle) * w; sy += Math.sin(angle) * w; weight += w;
  }
  const chroma = pixels ? weight / pixels : 0;
  const hue = weight > 0 && Math.hypot(sx, sy) > 1e-6 ? (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360 : null;
  return { pixels, luma: pixels ? luma / pixels : 0, whiteShare: pixels ? white / pixels : 0, hue, chroma, mean: pixels ? [r / pixels, g / pixels, b / pixels].map(v => Math.round(v)) : [0, 0, 0] };
}

/** Below this mean chroma a look is near-grey (e.g. a face-down worker): hue is undefined there. */
export const LOW_CHROMA = .12;
export const hueDistance = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

export async function measureLook(session: SceneSession) {
  const shot = async (crowd: boolean) => {
    await session.page.evaluate(c => window.__SCENE__!.hideProbe(true, !c, false, true), crowd);
    const png = await session.page.evaluate(async () => { await window.__SCENE__!.ready(); return document.querySelector('canvas')!.toDataURL('image/png'); });
    return PNG.sync.read(Buffer.from(png.slice(png.indexOf(',') + 1), 'base64'));
  };
  try {
    const withCrowd = await shot(true), withoutCrowd = await shot(false);
    return lookStats(withCrowd.data, withoutCrowd.data);
  } finally {
    await session.page.evaluate(() => window.__SCENE__!.hideProbe(false, false));
    await session.ready();
  }
}
