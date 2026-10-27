import type { Game } from '../../Game';

const profiles = new WeakMap<Game, Record<string, number>>();
/** Opt-in CPU wall times, summed over one render frame. Nested categories overlap.
 * Install after level readiness; this lives in the query-gated test API chunk. */
export function profileCpu(game: Game): Record<string, number> {
  const existing = profiles.get(game); if (existing) return { ...existing };
  const times: Record<string, number> = {}, frame: Record<string, number> = {};
  profiles.set(game, times);
  const wrap = (target: unknown, method: string, category: string, maximum?: string) => {
    if (!target || (typeof target !== 'object' && typeof target !== 'function')) return;
    const original: unknown = Reflect.get(target, method);
    if (typeof original !== 'function') return;
    frame[category] ??= 0;
    if (maximum) frame[maximum] ??= 0;
    let depth = 0;
    Reflect.set(target, method, function (this: unknown, ...args: unknown[]) {
      const outer = depth++ === 0, start = outer ? performance.now() : 0;
      try { return Reflect.apply(original, this, args); }
      finally {
        if (--depth === 0) {
          const elapsed = performance.now() - start;
          frame[category] += elapsed;
          if (maximum) frame[maximum] = Math.max(frame[maximum], elapsed);
        }
      }
    });
  };
  const view = game.view;
  wrap(game, 'simTick', 'simTick', 'simTickMax');
  wrap(game.world, 'update', 'sim');
  wrap(game.world.physics, 'update', 'physics');
  wrap(game.world.npcs, 'update', 'simNpcs');
  wrap(game.world.infected, 'update', 'ai');
  wrap(game.world.trapRescue, 'update', 'trapRescue');
  wrap(game.audio, 'update', 'audio');
  wrap(game.input, 'tap', 'telemetry');
  wrap(game.input, 'sample', 'input');
  wrap(view, 'advance', 'camera');
  wrap(view, 'update', 'view');
  wrap(Reflect.get(view, 'weather'), 'update', 'weather');
  wrap(game.view.renderer, 'render', 'render');
  wrap(Reflect.get(view, 'crowd'), 'update', 'crowd');
  wrap(Reflect.get(view, 'npcs'), 'update', 'npcs');
  wrap(Reflect.get(view, 'accessories'), 'finish', 'accessories');
  const districts: unknown = Reflect.get(view, 'districts');
  wrap(districts, 'updateFoliage', 'occlusion');
  wrap(districts, 'updateDoors', 'doors');
  wrap(districts, 'updateLods', 'lod');
  wrap(game.view.lightField, 'render', 'lightField');
  wrap(view, 'updateLights', 'lighting');
  wrap(game.ui, 'update', 'ui');
  game.ticker.events.on('frame', () => { for (const key in frame) frame[key] = 0; }, -100);
  game.ticker.events.on('frame', () => { Object.assign(times, frame); }, 100);
  return { ...times };
}
