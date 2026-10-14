import type { Game } from '../../Game';

const profiles = new WeakMap<Game, Record<string, number>>();
/** Opt-in CPU wall times, summed over one render frame. Nested categories overlap.
 * Install after level readiness; this lives in the query-gated test API chunk. */
export function profileCpu(game: Game): Record<string, number> {
  const existing = profiles.get(game); if (existing) return { ...existing };
  const times: Record<string, number> = {}, frame: Record<string, number> = {};
  profiles.set(game, times);
  const wrap = (target: unknown, method: string, category: string, maximum?: string) => {
    if (!target) return;
    const object = target as Record<string, (...args: never[]) => unknown>, original = object[method];
    if (typeof original !== 'function') return;
    frame[category] ??= 0;
    if (maximum) frame[maximum] ??= 0;
    let depth = 0;
    object[method] = function (...args: never[]) {
      const outer = depth++ === 0, start = outer ? performance.now() : 0;
      try { return original.apply(this, args); }
      finally {
        if (--depth === 0) {
          const elapsed = performance.now() - start;
          frame[category] += elapsed;
          if (maximum) frame[maximum] = Math.max(frame[maximum], elapsed);
        }
      }
    };
  };
  const view = game.view as unknown as Record<string, unknown>;
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
  wrap(view.weather, 'update', 'weather');
  wrap(game.view.renderer, 'render', 'render');
  wrap(view.crowd, 'update', 'crowd');
  wrap(view.npcs, 'update', 'npcs');
  wrap(view.accessories, 'finish', 'accessories');
  wrap(view.districts, 'updateFoliage', 'occlusion');
  wrap(view.districts, 'updateDoors', 'doors');
  wrap(view.districts, 'updateLods', 'lod');
  wrap(game.view.lightField, 'render', 'lightField');
  wrap(view, 'updateLights', 'lighting');
  wrap(game.ui, 'update', 'ui');
  game.ticker.events.on('frame', () => { for (const key in frame) frame[key] = 0; }, -100);
  game.ticker.events.on('frame', () => { Object.assign(times, frame); }, 100);
  return { ...times };
}
