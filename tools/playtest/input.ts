interface GroundClickControls {
  releaseKeys: () => Promise<void>;
  releaseAim: () => Promise<void>;
  mouse: { move: (x: number, y: number) => Promise<unknown>; down: () => Promise<unknown>; up: () => Promise<unknown> };
}

/** A click-to-move command takes over from held keyboard movement and attack input. */
export async function clickGroundInput(controls: GroundClickControls, x: number, y: number): Promise<void> {
  await controls.releaseAim();
  await controls.mouse.move(x, y); await controls.mouse.down();
  await new Promise(resolve => setTimeout(resolve, 40));
  await controls.mouse.up();
}
