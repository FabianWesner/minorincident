// Adapted from folio-2025 by Bruno Simon (MIT).
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
export function lerp(start: number, end: number, ratio: number): number {
  return (1 - ratio) * start + ratio * end;
}
