/** A short kick makes space while the real-input driver follows the visible retreat marker. */
export function keepMovingWithFists(level: string | null, _step: string | null, fistsOnly: boolean, nearbyEnemies: number): boolean {
  return level === 'L6' && fistsOnly && nearbyEnemies >= 3;
}
