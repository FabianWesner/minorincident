// Adapted from folio-2025 by Bruno Simon (MIT).
import { Pane } from 'tweakpane';
import type { Game } from '../Game';

/** Dev-only controls; the caller gates this module with DEV and ?debug. */
export class Debug {
  private readonly pane = new Pane({ title: 'Minor Incident · Foundation' });
  constructor(game: Game) {
    const controls = { timeScale: 1 };
    this.pane.addBinding(controls, 'timeScale', { min: 0, max: 20, step: 0.1 }).on('change', ({ value }) => game.clock.setTimeScale(value));
    this.pane.addButton({ title: 'Pause' }).on('click', () => game.clock.pause());
    this.pane.addButton({ title: 'Resume' }).on('click', () => game.clock.resume());
    this.pane.addButton({ title: 'Step' }).on('click', () => { game.clock.pause(); void game.step(1); });
  }
  dispose(): void { this.pane.dispose(); }
}
