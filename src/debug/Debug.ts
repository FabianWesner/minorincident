// Adapted from folio-2025 by Bruno Simon (MIT).
import { Pane } from 'tweakpane';
import type { Game } from '../Game';

/** Dev-only controls; the caller gates this module with DEV and ?debug. */
export class Debug {
  private readonly pane = new Pane({ title: 'Minor Incident' });
  constructor(game: Game) {
    const controls = { timeScale: 1, timeOfDay: 'golden', bloom: true, cheapDof: false, cameraShake: true };
    const rendering = this.pane.addFolder({ title: 'Rendering' });
    rendering.addBinding(controls, 'timeOfDay', { options: Object.fromEntries(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'golden'].map((name) => [name, name])) }).on('change', ({ value }) => game.view.settings({ timeOfDay: value as import('../data/timeOfDay').TimeOfDay }));
    for (const key of ['bloom', 'cheapDof', 'cameraShake'] as const) rendering.addBinding(controls, key).on('change', ({ value }) => game.view.settings({ [key]: value }));
    rendering.addButton({ title: 'Lookdev' }).on('click', () => { void game.loadScenario('lookdev'); });
    for (const spot of ['overview', 'street', 'shadow-probe']) rendering.addButton({ title: spot }).on('click', () => game.view.preset(spot));
    this.pane.addBinding(controls, 'timeScale', { min: 0, max: 20, step: 0.1 }).on('change', ({ value }) => game.clock.setTimeScale(value));
    this.pane.addButton({ title: 'Pause' }).on('click', () => game.clock.pause());
    this.pane.addButton({ title: 'Resume' }).on('click', () => game.clock.resume());
    this.pane.addButton({ title: 'Step' }).on('click', () => { game.clock.pause(); void game.step(1); });
  }
  dispose(): void { this.pane.dispose(); }
}
