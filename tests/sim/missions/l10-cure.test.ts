import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { levelTenMission } from '../../../src/levels/L10/mission';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { preset } from '../../../src/sim/progression/Campaign';
import { decodeSave } from '../../../src/sim/progression/Save';

const anchors = ['cure-crash', 'cure-residential', 'cure-industrial', 'cure-military', 'cure-research-entry', 'cure-terminal', 'cure-canister', 'cure-research', 'cure-corridor', 'cure-complex'];
// Separated anchors exercise ordinary spatial input rather than scripted objective completion.
test('T-E32-15/16/27-E2 @E32-AC05 @E32-AC15 @E32-AC16 @E32-AC27 terminal, unique backpack and death at every approach checkpoint', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('combat-arena'); applyCampaign(w, preset('L10-default'));
  const def = levelTenMission(name => ({ x: anchors.indexOf(name) * 5, z: 0, radius: 1 }));
  const m = w.loadMission(def); m.begin();
  const focus = (name: string) => {
    Object.assign(w.entities.get(1)!.transform, { x: def.anchors[name].x, z: 0 });
    w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true);
  };
  try {
    // Walking onto the canister before reading the terminal cannot skip prerequisites.
    focus('cure-canister'); w.setInput({ interact: true }); w.update(); w.clearInput();
    expect(m.state.items).toEqual([]); expect(m.state.states['terminal-read']).toBe(false);
    for (const name of anchors) {
      focus(name); w.setInput({ interact: true }); w.update(); w.clearInput();
      if (name === 'cure-terminal') {
        expect(m.state.subtitle?.id).toBe('L10.research');
        expect(m.state.subtitle?.text).toMatch(/airborne.*harmless.*kills.*dispersal/);
      }
      const carried = anchors.indexOf(name) >= anchors.indexOf('cure-canister');
      expect(m.state.items).toEqual(carried ? ['cure-canister'] : []);
      expect(m.state.states['cure-carried']).toBe(carried);
      if (!def.checkpoints.includes(name)) continue;
      const checkpoint = m.state.checkpoint;
      const saved = m.saveResume();
      const loadout = [...w.progression!.campaign!.ownedActions];
      w.tick += 180; // Expire the shared two-second respawn grace before the next death.
      w.player!.damage(1000, w.tick);
      expect(w.entities.get(1)!.health.current).toBe(0);
      for (let tick = 0; tick < 400 && w.entities.get(1)!.health.current === 0; tick++) w.update();
      expect(w.entities.get(1)!.health.current).toBeGreaterThan(0);
      expect(m.state.checkpoint).toBe(checkpoint);
      expect(m.state.items).toEqual(saved.checkpoint.state.items);
      expect(w.progression!.campaign!.ownedActions).toEqual(loadout);
      // A JSON round trip follows the real save validator and restores the unique mission inventory.
      const campaign = structuredClone(w.progression!.campaign!); campaign.cureResume = m.saveResume();
      const decoded = decodeSave(JSON.stringify(campaign)); expect(decoded.status).toBe('ok');
      if (decoded.status === 'ok') m.loadResume(decoded.save.cureResume!);
      expect(m.state.items).toEqual(saved.checkpoint.state.items);
    }
    expect(m.state.checkpoint).toBe('cure-complex');
    expect(m.state.items).toEqual(['cure-canister']);
    expect(w.combat!.runner.loadout.state.LEFT.rack.some(s => s.id === 'cure-canister')).toBe(false);
    focus('cure-canister'); w.setInput({ interact: true }); for (let i = 0; i < 60; i++) w.update();
    expect(m.state.items).toEqual(['cure-canister']);
    expect(w.progression!.campaign!.ownedActions).toContain('weapon.rocket-launcher');
    const rack = w.combat!.runner.loadout.state.RIGHT.rack;
    w.setInput({ selectedSlot: { side: 'RIGHT', index: rack.findIndex(s => s.id === 'weapon.rocket-launcher') }, right: { down: true, held: true, up: false }, aim: { x: 1, z: 0 } });
    for (let i = 0; i < 1200; i++) w.update();
    expect(w.events.events().filter(e => e.type === 'combat.attack' && e.actionId === 'weapon.rocket-launcher').length).toBeGreaterThanOrEqual(10);
    expect(m.state.items).toEqual(['cure-canister']);
    w.clearInput(); focus('cure-install'); w.setInput({ interact: true }); w.update(); w.clearInput();
    expect(m.state.checkpoint).toBe('cure-disperse-ready');
    expect(m.state.states['cure-carried']).toBe(false);
    w.tick += 180; // Expire the shared two-second respawn grace before the next death.
    w.player!.damage(1000, w.tick);
    expect(w.entities.get(1)!.health.current).toBe(0);
    for (let i = 0; i < 400 && w.entities.get(1)!.health.current === 0; i++) w.update();
    expect(m.state.states['cure-installed']).toBe(true);
    expect(m.state.states['cure-carried']).toBe(false);
    expect(m.state.items).toEqual(['cure-canister']);
  } finally { w.dispose(); }
});

test('T-E32-16-before-exit @E32-AC16 death before the exit returns the sole canister to the terminal', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('combat-arena'); applyCampaign(w, preset('L10-default'));
  try {
    const m = w.loadMission(levelTenMission(() => ({ x: 0, z: 0, radius: 2 })));
    m.begin(); m.loadCheckpoint('cure-research-entry');
    for (let attempt = 0; attempt < 2; attempt++) {
      w.setInput({ interact: true }); w.update(); w.update(); w.clearInput();
      expect(m.state.items).toEqual(['cure-canister']);
      expect(m.state.states['cure-carried']).toBe(true);
      w.tick += 180; // Expire the shared two-second respawn grace before the next death.
      w.player!.damage(1000, w.tick);
      expect(w.entities.get(1)!.health.current).toBe(0);
      for (let i = 0; i < 400 && w.entities.get(1)!.health.current === 0; i++) w.update();
      expect(m.state.checkpoint).toBe('cure-research-entry');
      expect(m.state.items).toEqual([]);
      expect(m.state.states['cure-carried']).toBe(false);
      expect(m.state.states['terminal-read']).toBe(false);
    }
  } finally { w.dispose(); }
});
