import { expect, test } from 'vitest';
import { SimPhase } from '../../../src/core/EventBus';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { levelTenMission } from '../../../src/levels/L10/mission';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { preset } from '../../../src/sim/progression/Campaign';
import { MegaPursuit } from '../../../src/sim/ai/MegaPursuit';
import { cureFinaleText } from '../../../src/sim/missions/LevelTenFinale';
import { decodeSave } from '../../../src/sim/progression/Save';

async function finale() {
  const w = new SimWorld(); await w.init(); w.loadScenario('mega-course', 327); applyCampaign(w, preset('L10-default'));
  const boss = w.megaPursuit = new MegaPursuit(w, { spawn: { x: -70, z: 0 }, introduceTick: null }); boss.introduce();
  const m = w.loadMission(levelTenMission(() => ({ x: 0, z: 0, radius: 2 })));
  m.begin(); m.loadCheckpoint('cure-complex');
  const step = (n = 1) => { for (let i = 0; i < n; i++) w.update(); };
  const press = () => { w.clearInput(); step(); w.setInput({ interact: true }); step(); w.clearInput(); };
  const at = (x: number, z = 0) => { Object.assign(w.entities.get(1)!.transform, { x, z }); w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); };
  const kill = () => { for (let i = 0; i < 10; i++) w.combat!.damage.apply({ sourceId: 1, targetId: boss.state.id, attackId: 500 + i, actionId: 'weapon.rocket-launcher', direct: true, origin: { x: 0, z: 0 }, direction: { x: -1, z: 0 }, base: 1, multiplier: 1, type: 'explosive', stagger: 0, knockback: 0 }); step(); };
  return { w, m, boss, step, press, at, kill };
}

for (const installed of [false, true]) for (const charged of [false, true]) for (const dead of [false, true]) {
  test(`T-E32-22 truth table installed=${installed} charge=${charged} dead=${dead} @E32-AC22`, async () => {
    const f = await finale(), { w, m, press, step, kill } = f;
    try {
      if (dead) kill();
      if (installed) press(); else m.state.states['cure-carried'] = false;
      // Fixture isolates each release predicate without waiting out eight duplicate timers.
      m.state.counters['charge-ticks'] = charged ? 3600 : 0;
      m.state.states['charge-ready'] = charged;
      m.state.states['charge-active'] = true;
      press(); step(); press();
      expect(m.state.states['cure-released']).toBe(installed && charged && dead);
      expect(w.events.events().filter(e => e.type === 'mission.signal' && e.name === 'cure-released')).toHaveLength(installed && charged && dead ? 1 : 0);
    } finally { w.dispose(); }
  });
}

test('T-E32-20/22 seed 327 install, pause, boundary, early rockets and explicit once-only release @E32-AC17 @E32-AC20 @E32-AC22', async () => {
  const { w, m, boss, press, step, at, kill } = await finale();
  try {
    kill(); expect(boss.state.mode).toBe('dead'); press();
    expect(m.state.checkpoint).toBe('cure-disperse-ready');
    expect(m.state.states['cure-carried']).toBe(false); expect(m.state.states['cure-installed']).toBe(true);
    expect(m.state.states['charge-active']).toBe(false); expect(m.state.counters['charge-ticks']).toBe(0);
    step(60); expect(m.state.counters['charge-ticks']).toBe(0);
    press(); expect(m.state.counters['charge-ticks']).toBe(0);
    at(25); step(120); expect(m.state.counters['charge-ticks']).toBe(120);
    at(25.001); step(120); expect(m.state.counters['charge-ticks']).toBe(120);
    expect(cureFinaleText(m)).toMatch(/Back to.*paused.*2\/60/);
    // Menu/focus never call sim.update; rendering and querying state are clock-free.
    const tick = w.tick; for (let i = 0; i < 120; i++) w.getState(); expect(w.tick).toBe(tick);
    at(0); step(3479); expect(m.state.states['charge-ready']).toBe(false);
    step(); expect(m.state.counters['charge-ticks']).toBe(3600); expect(m.state.steps.release.status).toBe('active');
    expect(m.state.states['cure-released']).toBe(false);
    at(3); press(); expect(m.state.states['cure-released']).toBe(false);
    at(0); press(); expect(m.state.states['cure-released']).toBe(true);
    press(); expect(w.events.events().filter(e => e.type === 'mission.signal' && e.name === 'cure-released')).toHaveLength(1);
  } finally { w.dispose(); }
});

test('T-E32-20/27 death restores ready boss/enemy/heat and zero charge; live save resumes exactly @E32-AC20 @E32-AC27', async () => {
  const { w, m, boss, press, step, kill } = await finale();
  try {
    const enemy = w.infected!.spawn('infected.runner', { x: 6, z: 3 }, { state: 'idle' });
    w.installMountedGun({ x: -10, y: 0, z: 0, yaw: 0 }); w.mountedGun!.gun.heat = .35;
    press(); const ready = m.saveResume(), heat = w.mountedGun!.heat; const hp = w.entities.get(boss.state.id)!.health.current;
    const bossAt = { ...w.entities.get(boss.state.id)!.transform };
    const enemyHP = w.entities.get(enemy)!.health.current, enemyAt = { ...w.entities.get(enemy)!.transform };
    const enemyCooldown = w.entities.get(enemy)!.infected!.cooldown;
    press(); step(120); kill(); w.entities.get(enemy)!.health.current = 1; w.mountedGun!.gun.heat = .9;
    let restored: { boss: NonNullable<ReturnType<typeof w.getEntity>>; enemy: NonNullable<ReturnType<typeof w.getEntity>>; heat: number; tick: number } | undefined;
    w.events.on('player.respawned', () => { restored = { boss: w.getEntity(boss.state.id)!, enemy: w.getEntity(enemy)!, heat: w.mountedGun!.heat, tick: w.tick }; }, SimPhase.cleanup);
    w.tick += 180; w.player!.damage(1000, w.tick);
    for (let i = 0; i < 400 && w.entities.get(1)!.health.current === 0; i++) step();
    expect(m.state.checkpoint).toBe('cure-disperse-ready'); expect(m.state.counters['charge-ticks']).toBe(0);
    expect(m.state.states['charge-active']).toBe(false); expect(m.state.states['cure-carried']).toBe(false);
    expect(w.entities.get(boss.state.id)!.health.current).toBe(hp); expect(boss.state.mode).not.toBe('dead');
    expect(restored!.heat).toBe(heat);
    expect(restored!.boss.transform).toEqual(bossAt);
    expect(restored!.enemy.health.current).toBe(enemyHP);
    expect(restored!.enemy.transform).toEqual(enemyAt);
    expect(restored!.enemy.infected!.cooldown).toBe(enemyCooldown ? enemyCooldown + restored!.tick - ready.current.tick : 0);
    expect(m.state.states['cure-installed']).toBe(ready.checkpoint.state.states['cure-installed']);
    const save = structuredClone(w.progression!.campaign!); save.cureResume = m.saveResume();
    const decoded = decodeSave(JSON.stringify(save)); expect(decoded.status).toBe('ok');
    if (decoded.status === 'ok') { m.loadResume(decoded.save.cureResume!); expect(m.state.counters['charge-ticks']).toBe(0); }
  } finally { w.dispose(); }
});


test('T-E32-16/27 pre-S7 save migration retains its reached cure checkpoint @E32-AC16 @E32-AC27', async () => {
  const { w, m } = await finale();
  try {
    const save = structuredClone(w.progression!.campaign!); save.cureResume = m.saveResume();
    for (const checkpoint of [save.cureResume.current, save.cureResume.checkpoint]) {
      delete checkpoint.state.states['charge-active']; delete checkpoint.state.states['console-held'];
    }
    const decoded = decodeSave(JSON.stringify(save)); expect(decoded.status).toBe('ok');
    if (decoded.status === 'ok') {
      m.loadResume(decoded.save.cureResume!);
      expect(m.state.checkpoint).toBe('cure-complex'); expect(m.state.states['charge-active']).toBe(false);
      expect(m.state.states['cure-carried']).toBe(true);
    }
  } finally { w.dispose(); }
});


test('T-E32-22 living boss blocks at 60 s; held input cannot release after its death @E32-AC22', async () => {
  const { w, m, boss, press, step, kill } = await finale();
  try {
    w.combat!.damage.god = true; press(); press();
    step(3600); expect(m.state.counters['charge-ticks']).toBe(3600);
    expect(m.state.steps.hold.status).toBe('active'); expect(cureFinaleText(m)).toContain('Kill the Mega Alpha');
    w.setInput({ interact: true }); step(); kill(); step();
    expect(boss.state.mode).toBe('dead'); expect(m.state.steps.release.status).toBe('active');
    expect(m.state.states['cure-released']).toBe(false);
    press(); expect(m.state.states['cure-released']).toBe(true);
  } finally { w.dispose(); }
});

test('T-E32-20 early kill captured at ready remains dead after death @E32-AC20 @E32-AC22', async () => {
  const { w, m, boss, press, step, kill } = await finale();
  try {
    kill(); press(); press(); step(120);
    w.tick += 180; w.player!.damage(1000, w.tick);
    for (let i = 0; i < 400 && w.entities.get(1)!.health.current === 0; i++) step();
    expect(boss.state.mode).toBe('dead'); expect(m.state.states['mega-dead']).toBe(true);
    expect(m.state.states['cure-installed']).toBe(true); expect(m.state.counters['charge-ticks']).toBe(0);
    expect(m.state.states['charge-active']).toBe(false);
  } finally { w.dispose(); }
});

test('T-E32-20 live save resumes accrued charge and captured living boss exactly @E32-AC20 @E32-AC27', async () => {
  const { w, m, boss, press, step, kill } = await finale();
  try {
    press(); press(); step(120);
    const save = structuredClone(w.progression!.campaign!); save.cureResume = m.saveResume();
    const bossAt = { ...w.entities.get(boss.state.id)!.transform }, hp = w.entities.get(boss.state.id)!.health.current;
    step(60); kill();
    const decoded = decodeSave(JSON.stringify(save)); expect(decoded.status).toBe('ok');
    if (decoded.status === 'ok') m.loadResume(decoded.save.cureResume!);
    expect(m.state.states['charge-active']).toBe(true); expect(m.state.counters['charge-ticks']).toBe(120);
    expect(w.entities.get(boss.state.id)!.transform).toEqual(bossAt); expect(w.entities.get(boss.state.id)!.health.current).toBe(hp);
    expect(boss.state.mode).not.toBe('dead'); step(); expect(m.state.counters['charge-ticks']).toBe(121);
  } finally { w.dispose(); }
});
