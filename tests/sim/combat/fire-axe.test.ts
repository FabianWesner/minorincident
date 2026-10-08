import { expect, test } from 'vitest';
import { Rng } from '../../../src/core/Rng';
import type { GameEvent } from '../../../src/sim/world/types';
import { arena, equip, fire, step } from './helpers';

/** E20 §5.3 fire axe: frontal swing against one or two, automatic 360 degree roundhouse when surrounded (>= 3 within 2.5 m). */
const runner = (w: Awaited<ReturnType<typeof arena>>, x: number, z: number) => w.spawnDummy('infected.runner', { x, z }, { hp: 40, radius: .35 });
const events = (w: Awaited<ReturnType<typeof arena>>, type: GameEvent['type']) => w.events.events().filter(e => e.type === type);

test('T-E20-10 @E20 @E20-AC10 axe single vs roundhouse table (20 seeds); the bat still needs two hits', async () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rng = new Rng(seed, 'axe-table');
    // One in front plus one behind (outside the 100 degree arc): a single swing, 45 damage, one-hit kill in front only.
    {
      const w = await arena(); equip(w, ['weapon.fire-axe']);
      const front = runner(w, 1.3 + rng.next() * .5, (rng.next() - .5) * .6), back = runner(w, -1.6 - rng.next() * .4, (rng.next() - .5) * .6);
      fire(w); step(w, 50);
      const attack = events(w, 'combat.attack')[0] as Extract<GameEvent, { type: 'combat.attack' }>;
      expect(attack.style, `seed ${seed}`).toBe('single');
      const hits = events(w, 'combat.hit') as unknown as { targetId: number; amount: number }[];
      expect(hits.map(h => h.targetId)).toEqual([front]);
      expect(hits[0].amount).toBe(40);
      expect(w.entities.get(front)!.health.current).toBe(0);
      // The full single-swing damage on a sturdier target.
      const sturdy = w.spawnDummy('infected.runner', { x: 1.4, z: 0 }, { hp: 100, radius: .35 });
      fire(w); step(w, 50);
      expect(w.entities.get(sturdy)!.health.current).toBe(100 - 45);
      expect(w.entities.get(back)!.health.current).toBe(40);
    }
    // Three to five within 2.5 m all around: the same input is a roundhouse hitting every one of them and pushing each >= 2 m.
    {
      const w = await arena(); equip(w, ['weapon.fire-axe']);
      const count = 3 + Math.floor(rng.next() * 3), ids: number[] = [], from = new Map<number, { x: number; z: number }>();
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2 + rng.next() * .4, r = 1.2 + rng.next() * 1;
        const id = runner(w, Math.cos(a) * r, Math.sin(a) * r); ids.push(id); from.set(id, { x: Math.cos(a) * r, z: Math.sin(a) * r });
      }
      fire(w); step(w, 70);
      const attack = events(w, 'combat.attack')[0] as Extract<GameEvent, { type: 'combat.attack' }>;
      expect(attack.style, `seed ${seed}`).toBe('roundhouse');
      const hits = events(w, 'combat.hit') as unknown as { targetId: number; amount: number }[];
      expect(new Set(hits.map(h => h.targetId))).toEqual(new Set(ids));
      expect(hits.length).toBeGreaterThanOrEqual(3);
      for (const id of ids) {
        const e = w.entities.get(id)!, p = from.get(id)!;
        expect(e.health.current, `seed ${seed}`).toBe(40 - 25);
        expect(Math.hypot(e.transform.x - p.x, e.transform.z - p.z), `seed ${seed} push`).toBeGreaterThanOrEqual(2);
      }
      // Roundhouse takes 1.0 s in total: the next swing is not ready before that.
      expect(w.combat!.runner.loadout.current('LEFT').readyAt - attack.tick).toBe(60);
    }
    // The bat from L1: a 40 HP infected needs two hits.
    {
      const w = await arena(); equip(w, ['weapon.bat']);
      const id = runner(w, 1.4, 0);
      fire(w); step(w, 40);
      expect(w.entities.get(id)!.health.current).toBeGreaterThan(0);
      fire(w); step(w, 40);
      expect(w.entities.get(id)!.health.current).toBe(0);
    }
  }
});
