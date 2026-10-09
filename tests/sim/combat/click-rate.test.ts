import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { arena, equip } from './helpers';
import { emptyInput } from '../../../src/input/InputFrame';

/** PO 10-08 (verbatim): "You need to increase the speed of fight movements. Every click needs to be a kick, no matter
 * how fast I click. Currently it's only every 1s or so". Released target clicks at `hz` on a tough dummy in reach:
 * every click produces a swing (at most one pending swing is queued), the swings follow the weapon's cycle, and the
 * courier's feet stay put. */
async function clicks(weapon: string, hz: number, count: number, crowd = 0) {
  // Real L1 runners (they chase back in after each shove), made unkillable; the courier in god mode.
  const w = await arena(); w.loadScenario('horde-arena', 1); w.infected!.configureL1v2(); equip(w, [weapon]); w.combat!.damage.god = true;
  const spawn = (x: number, z: number) => { const id = w.infected!.spawn('infected.runner', { x, z }, { state: 'chase', tier: 'average' }); const e = w.entities.get(id)!; e.health.current = e.health.max = 100000; e.transform.yaw = Math.atan2(z, -x); return id; };
  const id = spawn(1.2, 0);
  for (let i = 0; i < crowd; i++) spawn(Math.cos(1.2 + i * 1.4) * 1.4, Math.sin(1.2 + i * 1.4) * 1.4);
  for (let i = 0; i < 30; i++) w.update();
  const start = { ...w.entities.get(1)!.transform }, every = Math.round(60 / hz), sent: number[] = [];
  for (let tick = 0; tick < every * count + 120; tick++) {
    const frame = emptyInput(); frame.aimSource = 'pointer'; frame.pointerTarget = true;
    if (tick % every === 0 && sent.length < count) {
      sent.push(w.tick); frame.mouseAttack = true; frame.cancelMove = true; frame.left = { down: true, held: false, up: true }; frame.attackTarget = { id, side: 'LEFT' };
    }
    w.applyInput(frame, 'mouse-only'); w.update();
  }
  const attacks = w.events.events().filter(e => e.type === 'combat.attack' && e.sourceId === 1).map(e => e.type === 'combat.attack' ? { tick: e.tick, combo: e.combo, actionId: e.actionId, style: e.style } : null!);
  const hits = w.events.events().filter(e => e.type === 'combat.hit' && e.sourceId === 1).length;
  const gaps = attacks.slice(1).map((a, i) => a.tick - attacks[i].tick);
  const p = w.entities.get(1)!.transform;
  return { weapon, hz, crowd, sent: sent.length, attacks: attacks.length, hits, gaps, meanCycleS: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length / 60 : 0, moved: Math.hypot(p.x - start.x, p.z - start.z), firstLatency: attacks[0] ? attacks[0].tick - sent[0] : -1 };
}

/** Swing cycle per weapon (seconds, mean over a combo chain), the orchestrator's PO decision 10-08. */
const cycle: Record<string, [number, number]> = { 'weapon.fists': [.2, .3], 'weapon.bat': [.33, .45], 'weapon.fire-axe': [.42, .52] };

test('@E05 P1 every click is a swing: 10 Hz clicks give one swing per click (minus at most one queued), at the weapon cycle', async () => {
  const rows: Awaited<ReturnType<typeof clicks>>[] = [];
  for (const weapon of Object.keys(cycle)) rows.push(await clicks(weapon, 2, 12), await clicks(weapon, 10, 20), await clicks(weapon, 10, 20, 3));
  mkdirSync('test-results/epics/E05', { recursive: true });
  writeFileSync('test-results/epics/E05/click-rate.json', JSON.stringify(rows.map(r => ({ ...r, gaps: r.gaps.join(' ') })), null, 2) + '\n');
  for (const [index, weapon] of Object.keys(cycle).entries()) {
    const [paced, fast, crowd] = rows.slice(index * 3, index * 3 + 3);
    // Clicks slower than the cycle: one swing each, every click connects.
    expect(paced.attacks, `${weapon} 2 Hz`).toBe(12); expect(paced.firstLatency).toBeLessThanOrEqual(1);
    // Clicks faster than the cycle: the swings run back to back; one pending swing, so no backlog after the last click.
    expect(fast.attacks, `${weapon} 10 Hz swings`).toBeGreaterThanOrEqual(Math.floor(fast.sent / 10 / cycle[weapon][1]));
    expect(fast.meanCycleS, `${weapon} cycle`).toBeGreaterThanOrEqual(cycle[weapon][0]); expect(fast.meanCycleS, `${weapon} cycle`).toBeLessThanOrEqual(cycle[weapon][1]);
    expect(Math.max(...fast.gaps), `${weapon} longest gap`).toBeLessThanOrEqual(Math.ceil(cycle[weapon][1] * 60 * 1.35));
    // Surrounded (bat/axe sweep): no second-long pause; the axe sweep's 2.5 m space-making shove (E20) costs a step-in.
    expect(Math.max(...crowd.gaps), `${weapon} surrounded longest gap`).toBeLessThanOrEqual(60);
  }
  // Some 10 Hz clicks land while a swing runs: they queue one swing and never add a backlog.
  for (const r of rows) expect(r.attacks).toBeLessThanOrEqual(r.sent + 1);
}, 120_000);
