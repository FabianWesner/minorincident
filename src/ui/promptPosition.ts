export type PromptRect = { left: number; top: number; right: number; bottom: number };
/** Nearest free screen position; obstacle edges also cover narrow phone HUD gaps. */
export function interactionPromptPosition(preferred: { x: number; y: number }, size: { width: number; height: number }, viewport: PromptRect, obstacles: readonly PromptRect[]): { x: number; y: number } {
  const gap = 8, minX = viewport.left + gap, minY = viewport.top + gap;
  const maxX = Math.max(minX, viewport.right - gap - size.width), maxY = Math.max(minY, viewport.bottom - gap - size.height);
  const clampX = (x: number) => Math.max(minX, Math.min(maxX, x)), clampY = (y: number) => Math.max(minY, Math.min(maxY, y));
  const origin = { x: clampX(preferred.x), y: clampY(preferred.y) };
  if (obstacles.every(r => origin.x + size.width <= r.left - gap || origin.x >= r.right + gap || origin.y + size.height <= r.top - gap || origin.y >= r.bottom + gap)) return origin;
  const xs = new Set([origin.x, minX, maxX, ...obstacles.flatMap(r => [clampX(r.left - gap - size.width), clampX(r.right + gap)])]);
  const ys = new Set([origin.y, minY, maxY, ...obstacles.flatMap(r => [clampY(r.top - gap - size.height), clampY(r.bottom + gap)])]);
  let best = origin, leastOverlap = Infinity, nearest = Infinity;
  for (const x of xs) for (const y of ys) {
    const overlap = obstacles.reduce((sum, r) => sum + Math.max(0, Math.min(x + size.width, r.right + gap) - Math.max(x, r.left - gap)) * Math.max(0, Math.min(y + size.height, r.bottom + gap) - Math.max(y, r.top - gap)), 0);
    const distance = (x - origin.x) ** 2 + (y - origin.y) ** 2;
    if (overlap < leastOverlap || overlap === leastOverlap && distance < nearest) { best = { x, y }; leastOverlap = overlap; nearest = distance; }
    if (overlap === 0 && distance === 0) return best;
  }
  return best;
}
