// Adapted from folio-2025 by Bruno Simon (MIT).
export function lerp(start: number, end: number, ratio: number): number {
  return (1 - ratio) * start + ratio * end;
}
