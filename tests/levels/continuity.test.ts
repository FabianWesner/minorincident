import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { l2 } from '../../src/data/l2';
import { l1Canon, type L1Aftermath } from '../../src/levels/continuity';
import { captureL1Aftermath, validAftermath } from '../../src/sim/progression/carryover';
import { loadL1, runL1 } from '../../tools/sim-runner/l1Bots';
import { loadL2, runL2 } from '../../tools/sim-runner/l2Bots';

/**
 * Campaign continuity (PO 2026-10-08 "That building exploded in L1 but in L2 it's still unaffected"): a full L1 run with
 * the complete bot, its scripted destructions, the captured player-caused carryover, and the L2 world built from it.
 */
const HEAVY = 1_800_000;
const out = 'test-results/epics/continuity';
describe('L1 -> L2 world-state continuity', () => {
  test('T-CONT-01S @continuity after the L1 lab blast the L2 town has the burned annex, the debris cells blocked, the outbreak house aftermath and this run\'s carryover', async () => {
    const { world: w1, mission: m1 } = await loadL1(1);
    const events: string[] = [];
    for (const type of ['l1.blast', 'l1.smoke'] as const) w1.events.on(type, e => { events.push(e.type); });
    const run = runL1(w1, m1, 'complete', { seed: 1 });
    expect(run.outcome).toBe('complete');
    // The scripted L1 destructions happened: the pressure blast and its smoke, the outbreak house broke open.
    expect(events).toEqual(['l1.blast', 'l1.smoke']);
    expect(m1.state.l1!.house?.door).toBe(l1Canon.outbreakHouse.door);
    const aftermath = captureL1Aftermath(w1);
    expect(validAftermath(aftermath)).toBe(true);
    expect(captureL1Aftermath(w1)).toEqual(aftermath);                         // deterministic record
    expect(JSON.parse(JSON.stringify(aftermath))).toEqual(aftermath);          // survives the save round trip
    w1.dispose();
    mkdirSync(out, { recursive: true }); writeFileSync(`${out}/l1-aftermath-seed1.json`, JSON.stringify(aftermath, null, 2) + '\n');

    const { world: w2, mission: m2 } = await loadL2(1, 'high', aftermath);
    const d = w2.districts!.districts[0];
    expect(d.decay.placements.find(p => p.id === l1Canon.annex.placement)?.decay).toBe('burned');
    for (const r of l1Canon.annex.rubble) { const p = d.layout.placements.find(p => p.id === r.id)!; expect(w2.districts!.nav.walkable([p.position[0], p.position[2]])).toBe(false); }
    expect(d.decay.placements.some(p => p.id === 'carry-house-blood-1')).toBe(true);
    // Player-caused: bodies lie where they fell (those clear of L2 set pieces), moved props keep their pose.
    const bodies = [...w2.entities.iterate()].filter(e => e.civilian?.state === 'finished');
    for (const b of aftermath.bodies) expect(bodies.some(e => Math.hypot(e.transform.x - b.x, e.transform.z - b.z) < 1.2 && e.appearance?.asset === b.model)).toBe(true);
    for (const p of aftermath.props) { const item = w2.props!.items.find(i => i.id === p.id); if (item) expect(Math.hypot(item.pose.p[0] - p.p[0], item.pose.p[2] - p.p[2])).toBeLessThan(.25); }
    // L2 is still completable with the carryover (E20 band is the 20-seed battery in tests/levels/L2.test.ts).
    const l2run = runL2(w2, m2, 'complete', { seed: 1, maxSeconds: 600 });
    expect(l2run.outcome).toBe('complete');
    expect(l2run.simSeconds).toBeLessThanOrEqual(l2.bots.completeMedianS[1]);
    writeFileSync(`${out}/l2-with-aftermath-seed1.json`, JSON.stringify({ l1: { simSeconds: run.simSeconds }, l2: { simSeconds: l2run.simSeconds, deaths: l2run.deaths } }, null, 2) + '\n');
    w2.dispose();
  }, HEAVY);

  test('T-CONT-02S @continuity player-caused toys carry over: a pushed dumpster blocks its passage, a closed gate stays shut, the bike is parked', async () => {
    const aftermath: L1Aftermath = { version: 1, props: [], dumpsters: ['dumpster-1'], gatesClosed: ['gate-2'], bodies: [{ x: 10, z: 15.4, yaw: 1, model: 'npc.civilian-woman-a', tint: '#c4473d' }], bike: { x: 20.5, z: 6.4, yaw: .3 } };
    const canon = await loadL2(1);
    const { world } = await loadL2(1, 'high', aftermath);
    const toys = world.toys!, anchor = (name: string) => world.districts!.districts[0].layout.anchors[name].position;
    const [dumpster] = toys.dumpsterIds.filter(id => toys.anchorOf.get(id) === 'dumpster-1'), end = anchor('dumpster-1-end');
    expect(world.entities.get(dumpster)!.toy!.progress).toBe(1);
    expect(world.entities.get(dumpster)!.interactable!.enabled).toBe(false);
    expect(Math.hypot(world.entities.get(dumpster)!.transform.x - end[0], world.entities.get(dumpster)!.transform.z - end[2])).toBeLessThan(.01);
    expect(world.interactables!.nav!.walkable([end[0], end[2]])).toBe(false);
    expect(canon.world.interactables!.nav!.walkable([end[0], end[2]])).toBe(true);
    const [gate] = toys.gateIds.filter(id => toys.anchorOf.get(id) === 'gate-2');
    expect(world.entities.get(gate)!.interactable!.open).toBe(false);
    const g = anchor('gate-2');
    expect(world.interactables!.nav!.walkable([g[0], g[2]])).toBe(false);
    expect(canon.world.interactables!.nav!.walkable([g[0], g[2]])).toBe(true);
    expect(canon.world.entities.get(canon.world.toys!.gateIds.find(id => canon.world.toys!.anchorOf.get(id) === 'gate-2')!)!.interactable!.open).toBe(true);
    expect(world.districts!.districts[0].decay.placements.some(p => p.id === 'carry-bike')).toBe(true);
    expect([...world.entities.iterate()].some(e => e.civilian?.state === 'finished' && Math.hypot(e.transform.x - 10, e.transform.z - 15.4) < 1.2)).toBe(true);
    canon.world.dispose(); world.dispose();
  }, HEAVY);
});
