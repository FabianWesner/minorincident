import { expect, test } from 'vitest';
import { interactionPromptPosition } from '../../../src/render/InteractionView';

const overlap = (p: { x: number; y: number }, s: { width: number; height: number }, r: { left: number; top: number; right: number; bottom: number }) => Math.max(0, Math.min(p.x + s.width, r.right) - Math.max(p.x, r.left)) * Math.max(0, Math.min(p.y + s.height, r.bottom) - Math.max(p.y, r.top));
const portrait = { left: 0, top: 0, right: 390, bottom: 844 };
test('@E24-AC18 a gate prompt clears the captured portrait HUD at closest zoom', () => {
  const size = { width: 200, height: 101.578125 }, obstacles = [
    { left: 12, top: 12, right: 184, bottom: 68 }, { left: 282, top: 12, right: 378, bottom: 108 },
    { left: 80, top: 143.59375, right: 378, bottom: 221.984375 }, { left: 12, top: 76, right: 68, bottom: 132 },
    { left: 214, top: 12, right: 270, bottom: 68 }, { left: 301, top: 114, right: 359, bottom: 136 },
    { left: 0, top: 220, right: 160, bottom: 450 },
    { left: 238, top: 768, right: 302, bottom: 832 }, { left: 314, top: 692, right: 378, bottom: 756 },
  ];
  const placed = interactionPromptPosition({ x: 8, y: 8 }, size, portrait, obstacles);
  for (const r of obstacles) expect(overlap(placed, size, r)).toBe(0);
  expect(placed.x).toBeGreaterThanOrEqual(8); expect(placed.y).toBeGreaterThanOrEqual(8);
  expect(placed.x + size.width).toBeLessThanOrEqual(382); expect(placed.y + size.height).toBeLessThanOrEqual(836);
});
test('@E24-AC18 placement moves sideways when a full-height HUD blocks vertical escape', () => {
  const size = { width: 200, height: 110 }, obstacle = { left: 0, top: 0, right: 250, bottom: 390 };
  const placed = interactionPromptPosition({ x: 8, y: 80 }, size, { left: 0, top: 0, right: 844, bottom: 390 }, [obstacle]);
  expect(placed).toEqual({ x: 258, y: 80 }); expect(overlap(placed, size, obstacle)).toBe(0);
});
test('@E24-AC18 an already clear world anchor remains stable and visual viewport offsets are respected', () => {
  const preferred = { x: 110, y: 300 }, size = { width: 200, height: 100 };
  expect(interactionPromptPosition(preferred, size, portrait, [])).toEqual(preferred);
  expect(interactionPromptPosition({ x: -100, y: -100 }, size, { left: 20, top: 40, right: 410, bottom: 884 }, [])).toEqual({ x: 28, y: 48 });
});
