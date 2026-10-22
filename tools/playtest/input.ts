interface GroundClickControls {
  releaseKeys: () => Promise<void>;
  releaseAim: () => Promise<void>;
  mouse: { move: (x: number, y: number) => Promise<unknown>; down: () => Promise<unknown>; up: () => Promise<unknown> };
}

/** Keyboard steering toward a visible screen-space marker. */
export function markerWalkKeys(dx: number, dy: number, phase: number): string[] {
  const longest = Math.max(Math.abs(dx), Math.abs(dy)), keys: string[] = [];
  if (longest < 1) return keys;
  // Pulse the shorter axis rather than discarding it. A small lateral error
  // matters at the narrow stair runs even when the exit is still far ahead.
  if (dx && phase < Math.abs(dx) / longest) keys.push(dx > 0 ? 'KeyD' : 'KeyA');
  if (dy && phase < Math.abs(dy) / longest) keys.push(dy > 0 ? 'KeyS' : 'KeyW');
  return keys;
}

/** A click-to-move command takes over from held keyboard movement and attack input. */
export async function clickGroundInput(controls: GroundClickControls, x: number, y: number): Promise<void> {
  await controls.releaseKeys();
  await controls.releaseAim();
  await controls.mouse.move(x, y); await controls.mouse.down();
  await new Promise(resolve => setTimeout(resolve, 40));
  await controls.mouse.up();
}
