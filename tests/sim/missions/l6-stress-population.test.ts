import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { loadL6 } from '../../../tools/sim-runner/l6Bots';
import { followFrustum } from '../../../tools/sim-runner/l3Bots';
import { LevelSixBot } from '../../../src/debug/bot/LevelSixBot';
import { missionControls } from '../../../src/sim/missions/controls';
import { emptyInput } from '../../../src/input/InputFrame';

for (const tier of ['high', 'low'] as const) test(`T-E24-19-population @E24-AC19 stress fixture has 25 moving adults and ${tier === 'high' ? 40 : 30} infected on ${tier}`, async () => {
  const { world: w, mission } = await loadL6(1, tier);
  try {
    const controls = missionControls(w), step = (n: number) => { for (let i = 0; i < n; i++) w.update(); };
    w.combat!.damage.god = true;
    const lamp = w.entities.values().find(e => e.archetype === 'pickup.headlamp')!;
    controls.teleport(1, lamp.transform); w.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); step(24); w.clearInput();
    const bot = new LevelSixBot(w, 'complete');
    for (let i = 0; i < 180 * 60 && mission.state.l6!.leaderX < 128; i++) { followFrustum(w); w.applyInput(bot.sample(), 'keyboard'); w.update(); }
    w.clearInput();
    const friends = w.entities.values().filter(e => e.civilian?.survivor && e.health.current > 0 && !e.infected);
    friends.forEach((e, i) => controls.teleport(e.id, { x: 122 + Math.floor(i / 3) * 1.5, z: 14 + i % 3 * .8 }));
    controls.teleport(1, { x: 119, z: 15 });
    // Match the existing perf fixture's cleanup; dead infected stay in the world.
    for (const e of w.infected!.active) { e.health.current = 0; e.infected!.recoverAt = -1; }
    step(1);
    for (let i = 0; i < Math.max(0, 25 - friends.length); i++) w.npcs!.civilians.spawn('cashier', { x: 138 + i, z: 15 }, { model: 'npc.civilian-man-b.aftermath', waypoints: [{ x: 138 + i, z: 15 }, { x: 200, z: 15 }] });
    for (let i = 0; i < (tier === 'high' ? 40 : 30); i++) w.infected!.spawn('infected.runner', { x: 99 + Math.floor(i / 4) * 1.2, z: 13.8 + i % 4 * .75 });
    step(30);
    const adults = w.entities.values().filter(e => e.civilian?.adult && !e.infected && e.health.current > 0);
    const proof = { tier, tick: w.tick, leaderX: mission.state.l6!.leaderX, survivors: adults.length, moving: adults.filter(e => (e.motion?.speed ?? 0) > .05).length, infected: w.infected!.director.count, emergency: mission.state.l6!.emergency, flashlight: mission.state.l6!.flashlight };
    mkdirSync('test-results/ac-close', { recursive: true }); writeFileSync(`test-results/ac-close/l6-population-${tier}.json`, JSON.stringify(proof, null, 2));
    expect(proof.moving).toBeGreaterThanOrEqual(25); expect(proof.infected).toBeGreaterThanOrEqual(tier === 'high' ? 40 : 30);
    expect(proof.emergency).toBe(true); expect(proof.flashlight).toBe(true);
  } finally { w.dispose(); }
}, 180_000);
