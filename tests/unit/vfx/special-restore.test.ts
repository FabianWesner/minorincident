import { expect, test } from 'vitest';
import { infectedSpecialMoves, type InfectedSpecialMove } from '../../../src/data/infected';
import { Vfx } from '../../../src/render/vfx/Vfx';
import type { MissionDef } from '../../../src/sim/missions/types';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { stateHash } from '../../../src/sim/world/stateHash';

const mission: MissionDef = {
  id: 'special-restore', briefing: 'Special restore', anchors: { spawn: { x: 0, z: 0, radius: 2 } },
  actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: ['C'], cinematics: {},
  steps: [{ id: 'wait', type: 'custom', text: 'Wait', anchor: 'spawn', start: { kind: 'start' }, complete: { kind: 'timer', seconds: 1000 }, fail: [] }],
  finish: ['wait'], onStart: [], onComplete: [],
};
for (const move of Object.keys(infectedSpecialMoves) as InfectedSpecialMove[]) {
  test(`T-E07-restore-marker-${move} @E07-AC05 @E07-AC06 @E07-AC19 restored windup renders its locked warning without changing sim state`, async () => {
    const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 7); w.inspectionGhost = true;
    const m = w.loadMission(mission); m.begin();
    const timing = infectedSpecialMoves[move], id = w.infected!.spawn(timing.archetype, { x: 6, z: 0 }, { state: 'idle' });
    if (move === 'zebra.stampede' || move === 'flamingo.dive') for (const z of [-2, 2]) w.infected!.spawn(timing.archetype, { x: 6, z }, { state: 'idle' });
    const fx = new Vfx(w, { flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });
    try {
      expect(w.infected!.startSpecial(id, move, { id: 1, x: 0, z: 0 }, { x: 6, z: 0, radius: 1, dx: -1, dz: 0 })).toBe(true);
      fx.updateSpecialState();
      const first = fx.snapshot().telegraphs.find(t => t.sourceId === id)!;
      expect(fx.telegraphs.mesh.geometry.getAttribute('fxVisibility').getX(first.slot)).toBe(1);
      for (let i = 0; i < timing.windup - 1; i++) { w.update(); fx.advance(1 / 60); }
      m.checkpoint('C');
      const original = structuredClone(w.entities.get(id)!.infected!.specialAttack!);
      w.update(); fx.advance(1 / 60);
      expect(fx.snapshot().telegraphs.some(t => t.attackId === original.attackId)).toBe(false);
      m.restore('C');
      const hash = stateHash(w.getState()); fx.updateSpecialState();
      const tells = fx.snapshot().telegraphs.filter(t => t.sourceId === id);
      expect(tells).toHaveLength(1); expect(tells[0].attackId).toBe(original.attackId);
      expect(fx.telegraphs.mesh.geometry.getAttribute('fxVisibility').getX(tells[0].slot)).toBe(1);
      expect(stateHash(w.getState())).toBe(hash);
      // Repeated paused redraws neither duplicate nor consume the warning.
      fx.advance(0); expect(fx.snapshot().telegraphs.filter(t => t.sourceId === id)).toHaveLength(1);
      w.update(); fx.advance(1 / 60);
      expect(fx.snapshot().telegraphs.some(t => t.attackId === original.attackId)).toBe(false);
    } finally { fx.dispose(); w.dispose(); }
  });
}
