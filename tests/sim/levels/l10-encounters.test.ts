import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import { cure } from '../../../src/levels/L10/district';
import { cureEncounters, cureEncounterSlots, cureMedkits } from '../../../src/levels/L10/encounters';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { preset } from '../../../src/sim/progression/Campaign';
import type { DistrictLayout } from '../../../src/levels/districts/types';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;

for (const tier of ['high', 'low'] as const) test(`T-E32-06-E2-${tier} @E32-AC02 @E32-AC06 @E32-AC09 @E32-AC15 @E32-AC16 @E32-AC27 depth population, health detours and checkpoint slot persistence`, async () => {
  const w = new SimWorld(); await w.init();
  try {
    w.loadComposition(compositions.L10, [layout], 32); applyCampaign(w, preset('L10-default'));
    w.chunks!.setQuality(tier);
    const m = w.loadMission(resolveCampaignMission('L10', w.districts!)); m.begin(); w.update();
    const focus = (x: number, z: number) => {
      Object.assign(w.entities.get(1)!.transform, { x, z });
      w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); w.chunks!.update();
    };
    const populate = () => { w.tick += 10 - w.tick % 10; w.l10Encounters!.update(); };
    populate();
    expect(w.infected!.active.length).toBeGreaterThanOrEqual(4);
    expect(w.infected!.active.length).toBeLessThanOrEqual(8);
    expect(w.infected!.active.every(e => e.archetype === 'infected.runner')).toBe(true);
    const before = w.l10Encounters!.snapshot();
    w.combat!.setLoadout(['weapon.army-mg'], ['weapon.army-mg']); populate();
    expect(w.l10Encounters!.snapshot()).toEqual(before); // Inventory alone cannot create a threat.
    applyCampaign(w, preset('L10-default'));
    focus(767, 25); populate();
    expect(Object.keys(w.l10Encounters!.state.spawned).every(key => key.startsWith('crash-'))).toBe(true);
    expect(w.infected!.director.count).toBeLessThanOrEqual(8);
    w.tick = 3600; w.update();
    for (const region of cure.regions.slice(0, 6)) {
      const groups = cureEncounters.filter(g => g.region === region.id);
      const slots = groups.flatMap(g => cureEncounterSlots(g, tier));
      for (const group of groups) {
        const specials = (quality: 'high' | 'low') => cureEncounterSlots(group, quality).filter(s => ['infected.dog', 'infected.alpha'].includes(s.archetype)).map(s => s.key);
        expect(specials('low')).toEqual(specials('high'));
      }
      const curve = cure.threatDepth.find(d => d.region === region.id)!;
      expect(slots.length).toBeGreaterThanOrEqual(curve.resident[tier][0]);
      expect(slots.length).toBeLessThanOrEqual(curve.resident[tier][1]);
      for (const g of groups) {
        focus(g.at[0] - 55, g.at[1]); populate();
        expect(w.infected!.director.count).toBeLessThanOrEqual(tier === 'high' ? 200 : 100);
      }
      expect(slots.every(s => !!w.l10Encounters!.state.spawned[s.key])).toBe(true);
      expect(slots.filter(s => s.archetype === 'infected.alpha').length).toBe(curve.alphas[1]);
      if (region.id === 'research-campus' || region.id === 'destroyed-corridor') {
        focus(region.id === 'research-campus' ? 2707 : 3317, region.id === 'research-campus' ? 45 : 95); populate();
        expect(w.infected!.director.count, `${region.id} resident peak`).toBeGreaterThanOrEqual(curve.resident[tier][0]);
      }
      if (region.id === 'research-campus') {
        focus(...cure.anchors['cure-research-entry']); w.update();
        expect(m.state.checkpoint).toBe('cure-research-entry');
        for (const name of ['cure-terminal', 'cure-canister', 'cure-research']) {
          focus(...cure.anchors[name]); w.setInput({ interact: true }); w.update(); w.clearInput();
        }
        expect(m.state.items).toEqual(['cure-canister']);
        expect(m.state.states['terminal-read']).toBe(true);
        expect(m.state.states['cure-carried']).toBe(true);
        expect(m.state.checkpoint).toBe('cure-research');
        expect(w.events.events().filter(e => e.type === 'dialogue.line' && e.id === 'L10.research')).toHaveLength(1);
      }
      if (region.weapon) {
        // Complete the current spatial interaction through ordinary input, then retry that exact transaction.
        focus(...cure.anchors[region.checkpoint]); w.clearInput();
        w.setInput({ interact: true }); for (let i = 0; i < 45; i++) w.update(); w.clearInput();
        expect(m.state.checkpoint).toBe(region.checkpoint);
        expect(w.progression!.campaign!.ownedActions).toContain(region.weapon);
        const saved = m.saveResume();
        focus(547, 0); populate(); m.restore();
        expect(w.progression!.campaign!.ownedActions).toContain(region.weapon);
        expect(w.l10Encounters!.snapshot()).toEqual(saved.checkpoint.seams!.l10Encounters);
        const ids = Object.values(w.l10Encounters!.state.spawned);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
    focus(...cure.anchors['cure-complex']); w.update();
    expect(m.state.checkpoint).toBe('cure-complex');
    expect(m.state.items).toEqual(['cure-canister']);
    expect(w.progression!.campaign!.ownedActions).toContain('weapon.rocket-launcher');
    for (const kit of cureMedkits) {
      focus(...kit.at); populate();
      expect(w.infected!.nav.clear(kit.at[0], kit.at[1], .3), kit.id).toBe(true);
      const id = w.l10Encounters!.state.medkits[kit.id]; expect(id).toBeGreaterThan(0);
      w.entities.get(1)!.health.current = 40; w.pickups!.update();
      expect(w.entities.get(1)!.health.current).toBe(90);
      focus(547, 0); focus(...kit.at); populate(); w.pickups!.update();
      expect(w.entities.get(1)!.health.current).toBe(90); // Collected kit remains consumed after streaming.
      expect(w.l10Encounters!.state.medkits[kit.id]).toBe(id);
    }
  } finally { w.dispose(); }
});
