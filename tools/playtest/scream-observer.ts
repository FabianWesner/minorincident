import type { Game } from '../../src/Game';

/** Page-side observer: rebind after every mission load, including a reused world. */
export function installScreamObserver(): void {
      let bound: unknown;
      const bind = () => {
        requestAnimationFrame(bind);
        const w = (window.__SCENE__ as unknown as { game?: Game })?.game?.world;
        if (!w?.missions || bound === w.missions) return;
        bound = w.missions;
        w.events.on('sim.tick', () => {
          if (w.tick % 120) return;
          const actors = [...w.entities.iterate()].filter(e => e.infected?.alphaType === 'screamer').map(e => ({ id: e.id, hp: e.health.current, at: { ...e.transform }, brain: { state: e.infected!.state, targetId: e.infected!.targetId, cooldown: e.infected!.cooldown, specialAttack: e.infected!.specialAttack }, courier: { ...w.entities.get(1)!.transform } }));
          if (actors.length) void (window as unknown as { qaAlphaReceipt(e: unknown): Promise<void> }).qaAlphaReceipt({ tick: w.tick, level: w.scenario, actors });
        });
        w.events.on('telegraph', event => {
          if (event.type === 'telegraph' && 'special' in event && (event.special === 'alpha.roar' || event.special === 'scream'))
            void (window as unknown as { qaScreamCapture(e: unknown): Promise<void> }).qaScreamCapture({ ...event, level: w.scenario, warning: event.special === 'alpha.roar' ? 'alpha-roar' : 'scream' });
        });
        w.events.on('noise', event => {
          if (event.type === 'noise' && event.kind === 'scream')
            void (window as unknown as { qaScreamCapture(e: unknown): Promise<void> }).qaScreamCapture({ ...event, level: w.scenario });
        });
      }; bind();
}
