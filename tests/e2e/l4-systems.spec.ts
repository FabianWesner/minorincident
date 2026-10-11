import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ viewport: { width: 390, height: 844 } });
  test(`T-E22-09-12-13-systems-${tier} @E22-AC09 @E22-AC12 @E22-AC13 Scene Lab soldier focus, human shot blocking and physical gap`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(`/?test=1&scenelab&renderer=webgl&quality=${tier}&audio=muted`);
    await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    for (const name of ['focus', 'block', 'gap']) {
      const spec = JSON.parse(readFileSync(`tests/scenes/l4-systems/${name}.json`, 'utf8')) as SceneSpec;
      if (tier === 'low') spec.camera = { mode: 'game', target: name === 'focus' ? [2, 3] : [0, 0], zoom: (name === 'focus' ? 1.7 : name === 'gap' ? 1.5 : 1.15) * 2.2 };
      const proof = await page.evaluate(async ({ spec, name }) => {
        const lab = window.__SCENE__!, api = window.__SS__!; await api.ready; await lab.load(spec);
        const actors = lab.describe().actors;
        const id = (name: string) => actors.find(a => a.id === name)!.entity;
        const soldierIds = actors.filter(a => a.id.startsWith('soldier')).map(a => a.entity);
        // Nonvisual Hetzner gate: replay the same Scene Lab commands through fixed sim ticks.
        // Per-frame rendering and its budgets are exercised by the separate Mac captures/perf suite.
        let frame = 0;
        const advance = async (until: number) => {
          for (const s of spec.script ?? []) if (s.frame >= frame && s.frame < until) {
            await api.step(s.frame - frame); frame = s.frame;
            if ('actor' in s) lab.command(s.actor, s.do);
          }
          await api.step(until - frame); frame = until;
        };
        await advance(name === 'block' ? 27 : spec.frames!);
        const before = { hp: api.getEntity(id('alpha'))!.health.current, shots: api.events().filter(e => e.type === 'ally.attack' && soldierIds.includes(e.sourceId)).length };
        if (name === 'block') await advance(147);
        return { before, alphaId: id('alpha'), soldiers: soldierIds, events: api.events(),
          entities: actors.map(a => ({ name: a.id, entity: api.getEntity(a.entity)! })), barricades: api.barricades.slots() };
      }, { spec, name });
      const shots = proof.events.filter(e => e.type === 'ally.attack' && proof.soldiers.includes(e.sourceId));
      if (name === 'block') {
        expect(proof.before.shots).toBe(0); expect(proof.before.hp).toBe(300);
        expect(shots.length).toBeGreaterThan(0);
        const civilian = proof.entities.find(a => a.name === 'civilian')!.entity;
        expect(civilian.health.current).toBe(100);
        expect(proof.events.some(e => e.type === 'civilian.state' && e.id === civilian.id && e.state === 'flee')).toBe(true);
        expect(proof.entities.find(a => a.name === 'alpha')!.entity.health.current).toBeLessThan(300);
      } else {
        for (const id of proof.soldiers) {
          const focused = shots.filter(e => e.type === 'ally.attack' && e.sourceId === id && e.targetId === proof.alphaId);
          expect(focused.length).toBeGreaterThanOrEqual(8);
          expect(focused.at(-1)!.tick - focused[0].tick).toBeGreaterThanOrEqual(180);
        }
        if (name === 'focus') expect(shots.every(e => e.type === 'ally.attack' && e.targetId === proof.alphaId)).toBe(true);
        if (name === 'gap') {
          expect(proof.barricades[0].state.intact).toBe(false);
          expect(proof.events.some(e => e.type === 'barricade.damaged' && e.sourceId === proof.alphaId && e.previousHp === 300 && e.hp === 0 && e.amount === 300)).toBe(true);
          expect(proof.entities.filter(a => a.name.startsWith('regular') && a.entity.transform.x < 0)).toHaveLength(3);
        }
      }
    }
  });

});
