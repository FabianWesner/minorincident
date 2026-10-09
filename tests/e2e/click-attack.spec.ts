import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { boot, expect, test } from './fixtures';

// P1 (PO on PROD, verbatim): "I often have the problem that I click on a Zombie but the attack is not performed. This is a
// bit frustrating." Real mouse clicks land on the *drawn* body of an infected (head, chest, hips, feet from the rendered
// rig pose), in every state the PO meets in a fight, with a 60 Hz timing scatter (random tick phase before each click)
// and a few pixels of aim scatter. A click counts when, within 6 ticks (100 ms), an attack on that infected starts, or
// the click is queued correctly (an approach toward it when it is out of reach, or the next swing queued while the
// courier is still in a swing's recovery). The miss causes are classified; the gate is a miss rate <= 2 % (target 0).

type Part = 'head' | 'chest' | 'hip' | 'feet';
type Kind = 'idle-near' | 'idle-mid' | 'idle-far' | 'approaching' | 'attacking' | 'staggered' | 'recovery' | 'downed' | 'group' | 'behind';
interface Outcome { kind: Kind; part: Part; distance: number; result: 'attack' | 'queued' | 'approach' | 'move' | 'wrong-target' | 'dropped' | 'late'; ticks: number; target: number; picked?: number; moved: number; candidates?: string }

const parts: Part[] = ['head', 'chest', 'hip', 'feet'];

/** Deterministic LCG for the scatter (stable runs, comparable before/after). */
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

/** Client pixel of a drawn body part of entity `id`, from the rendered pose of the last frame. */
async function bodyPoint(page: Page, id: number, part: Part): Promise<{ x: number; y: number } | null> {
  return page.evaluate(({ id, part }) => {
    const a = window.__SS__!, f = a.crowdFigures().find(f => f.id === id && f.drawn && f.joints);
    if (!f?.joints) return null;
    const j = f.joints, head = j.head, hip = j.hip, feet = [(j.footL[0] + j.footR[0]) / 2, (j.footL[1] + j.footR[1]) / 2, (j.footL[2] + j.footR[2]) / 2];
    // The head pivot is the neck; the visible head centre sits ~0.1 m further along the hip→head axis.
    const axis = [head[0] - hip[0], head[1] - hip[1], head[2] - hip[2]], length = Math.hypot(axis[0], axis[1], axis[2]) || 1;
    const p = part === 'head' ? head.map((v, i) => v + axis[i] / length * .1) : part === 'chest' ? hip.map((v, i) => v + axis[i] * .6) : part === 'hip' ? hip : feet;
    const ndc = a.camera.project(p[0], p[1], p[2]), rect = document.querySelector('canvas')!.getBoundingClientRect();
    return { x: rect.left + (ndc[0] + 1) / 2 * rect.width, y: rect.top + (1 - ndc[1]) / 2 * rect.height };
  }, { id, part });
}

async function setup(page: Page, loadout: string[]) {
  await page.evaluate(async (loadout) => {
    const a = window.__SS__!; await a.loadScenario('horde-arena'); a.pause(); a.cheats.god(true); a.setLoadout(loadout, ['weapon.fists']);
  }, loadout);
}

/** Hold LMB on the target through injected input until it is downed (0 HP, recovering later). */
async function knockDown(page: Page, id: number) {
  await page.evaluate(async (id) => {
    const a = window.__SS__!;
    a.input.set({ attackTarget: { id, side: 'LEFT' }, mouseAttack: true, pointerTarget: true, left: { down: true, held: true, up: false }, aimSource: 'pointer' });
    for (let i = 0; i < 240 && a.getEntity(id)!.health.current > 0; i++) await a.step(1);
    a.input.clear(); await a.step(40);
  }, id);
}

/** One click on a drawn body part; watch 6 ticks (or the remaining swing + 6 for a queued click). */
async function click(page: Page, kind: Kind, target: number, part: Part, random: () => number, others: number[] = []): Promise<Outcome | null> {
  await page.evaluate(() => window.__SS__!.screenshotReady());
  const point = await bodyPoint(page, target, part);
  if (!point) return null;
  const before = await page.evaluate((target) => {
    const a = window.__SS__!, s = a.getState(), p = s.player!.transform, t = a.getEntity(target)!.transform;
    const running = s.combat?.running?.find(r => r.sourceId === 1);
    return { tick: s.tick, x: p.x, z: p.z, distance: Math.hypot(t.x - p.x, t.z - p.z), runningEnds: running && running.endsAt > s.tick ? running.endsAt : 0 };
  }, target);
  const jitter = () => (random() - .5) * 6;
  await page.mouse.move(point.x + jitter(), point.y + jitter()); await page.mouse.down(); await page.mouse.up();
  const window_ = before.runningEnds ? before.runningEnds - before.tick + 6 : 6;
  let result: Outcome['result'] | null = null, ticks = 0, picked: number | undefined;
  for (ticks = 1; ticks <= window_ && !result; ticks++) {
    const r = await page.evaluate(({ target, since }) => {
      const a = window.__SS__!; return a.step(1).then(() => {
        const s = a.getState(), attack = a.events(since).find(e => e.type === 'combat.attack' && e.sourceId === 1);
        return { attack: !!attack, intent: s.controls?.attack?.id ?? null, move: !!s.controls?.moveTarget, aim: attack && attack.type === 'combat.attack' ? attack.direction : null,
          toTarget: (() => { const p = s.player!.transform, t = a.getEntity(target)!.transform, d = Math.hypot(t.x - p.x, t.z - p.z) || 1; return { x: (t.x - p.x) / d, z: (t.z - p.z) / d }; })() };
      });
    }, { target, since: before.tick });
    if (r.move) { result = 'move'; break; }
    if (r.intent !== null && r.intent !== target) { result = 'wrong-target'; picked = r.intent; break; }
    if (r.attack) {
      const facing = r.aim ? r.aim.x * r.toTarget.x + r.aim.z * r.toTarget.z : 1;
      result = facing > .5 ? before.runningEnds ? 'queued' : 'attack' : 'wrong-target'; break;
    }
    if (ticks === window_ && r.intent === target) result = before.distance > 1.6 ? 'approach' : 'late';
  }
  if (!result) result = 'dropped';
  const after = await page.evaluate(() => window.__SS__!.getState().player!.transform);
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  void others;
  const candidates = await page.evaluate(() => window.__SS__!.input.lastPick());
  return { kind, part, distance: Math.round(before.distance * 100) / 100, result, ticks, target, ...(picked !== undefined ? { picked } : {}), moved: Math.round(moved * 1000) / 1000, candidates: candidates.map(c => `${c.id}:${c.score.toFixed(2)}${c.drawn ? '' : '(sim)'}`).join(' ') };
}

function summary(rows: Outcome[]) {
  const ok = (r: Outcome) => r.result === 'attack' || r.result === 'queued' || r.result === 'approach';
  const misses = rows.filter(r => !ok(r));
  const byCause: Record<string, number> = {}, byKind: Record<string, { clicks: number; misses: number }> = {}, byPart: Record<string, { clicks: number; misses: number }> = {};
  for (const r of misses) byCause[r.result] = (byCause[r.result] ?? 0) + 1;
  for (const r of rows) {
    (byKind[r.kind] ??= { clicks: 0, misses: 0 }).clicks++; (byPart[r.part] ??= { clicks: 0, misses: 0 }).clicks++;
    if (!ok(r)) { byKind[r.kind].misses++; byPart[r.part].misses++; }
  }
  return { clicks: rows.length, misses: misses.length, missRate: rows.length ? misses.length / rows.length : 0, byCause, byKind, byPart };
}

test('T-E05-click-attack @E05 @E03 clicks on the drawn body of an infected start an attack (miss rate <= 2 %)', async ({ page }) => {
  test.setTimeout(600_000);
  await boot(page);
  await page.evaluate(() => window.__SS__!.debug.figureJoints(true));
  const random = rng(7), rows: Outcome[] = [];
  const add = (o: Outcome | null) => { if (o) rows.push(o); };
  const scatter = async () => page.evaluate(n => window.__SS__!.step(n), Math.floor(random() * 4));
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];

  // Standing infected at three distances and eight angles (idle: they face away, no sight of the courier).
  for (const [kind, distance] of [['idle-near', 1.2], ['idle-mid', 2.6], ['idle-far', 5]] as const) {
    for (const [i, angle] of angles.entries()) {
      await setup(page, i % 2 ? ['weapon.bat'] : ['weapon.fists']);
      const id = await page.evaluate(({ distance, angle }) => window.__SS__!.spawn('infected.runner', { x: Math.cos(angle * Math.PI / 180) * distance, z: Math.sin(angle * Math.PI / 180) * distance }, { state: 'idle', yaw: angle * Math.PI / 180 }), { distance, angle });
      await page.evaluate(() => window.__SS__!.step(2)); await scatter();
      add(await click(page, kind, id, parts[(i + (kind === 'idle-mid' ? 1 : kind === 'idle-far' ? 2 : 0)) % 4], random));
    }
  }
  // Approaching (chasing from 6 m), clicked while it runs in.
  for (const [i, angle] of angles.entries()) {
    await setup(page, ['weapon.fists']);
    const id = await page.evaluate(({ angle }) => window.__SS__!.spawn('infected.runner', { x: Math.cos(angle * Math.PI / 180) * 6, z: Math.sin(angle * Math.PI / 180) * 6 }, { state: 'chase', yaw: angle * Math.PI / 180 + Math.PI }), { angle });
    await page.evaluate(n => window.__SS__!.step(n), 20 + Math.floor(random() * 25));
    add(await click(page, 'approaching', id, parts[i % 4], random));
  }
  // Attacking / lunging: in reach, wind-up or swing on the courier (god mode keeps her up).
  for (const [i, angle] of angles.entries()) {
    await setup(page, i % 2 ? ['weapon.bat'] : ['weapon.fists']);
    const id = await page.evaluate(({ angle }) => window.__SS__!.spawn('infected.runner', { x: Math.cos(angle * Math.PI / 180) * 1.3, z: Math.sin(angle * Math.PI / 180) * 1.3 }, { state: 'chase', yaw: angle * Math.PI / 180 + Math.PI }), { angle });
    await page.evaluate(async (id) => { const a = window.__SS__!; for (let t = 0; t < 180 && a.getEntity(id)!.infected!.state !== 'attack'; t++) await a.step(1); }, id);
    await scatter();
    add(await click(page, 'attacking', id, parts[(i + 1) % 4], random));
  }
  // Staggered by the courier's own hit, then clicked again during the flinch *and* the courier's swing recovery.
  for (let i = 0; i < 8; i++) {
    await setup(page, i % 2 ? ['weapon.bat'] : ['weapon.fists']);
    const angle = angles[i];
    const id = await page.evaluate(({ angle }) => window.__SS__!.spawn('infected.runner', { x: Math.cos(angle * Math.PI / 180) * 1.2, z: Math.sin(angle * Math.PI / 180) * 1.2 }, { state: 'idle', yaw: angle * Math.PI / 180 }), { angle });
    await page.evaluate(() => window.__SS__!.step(2));
    add(await click(page, 'idle-near', id, parts[i % 4], random));
    // The swing has started; wait 1..14 ticks into it (flinch + recovery), click again.
    await page.evaluate(n => window.__SS__!.step(n), 1 + Math.floor(random() * 14));
    add(await click(page, i % 2 ? 'staggered' : 'recovery', id, parts[(i + 2) % 4], random));
  }
  // Downed (0 HP, lying, recovers later): a click restarts its down time (PO 10-08), so it must swing at it.
  for (let i = 0; i < 8; i++) {
    await setup(page, ['weapon.bat']);
    const angle = angles[i];
    const id = await page.evaluate(({ angle }) => window.__SS__!.spawn('infected.runner', { x: Math.cos(angle * Math.PI / 180) * 1.2, z: Math.sin(angle * Math.PI / 180) * 1.2 }, { state: 'idle', yaw: angle * Math.PI / 180 }), { angle });
    await knockDown(page, id);
    add(await click(page, 'downed', id, parts[i % 4], random));
  }
  // Group of five around the courier; click a different member each time.
  for (let i = 0; i < 8; i++) {
    await setup(page, i % 2 ? ['weapon.bat'] : ['weapon.fists']);
    const ids = await page.evaluate((offset) => [0, 1, 2, 3, 4].map(k => { const angle = offset + k * Math.PI * 2 / 5, r = 1.3 + (k % 2) * .5; return window.__SS__!.spawn('infected.runner', { x: Math.cos(angle) * r, z: Math.sin(angle) * r }, { state: 'chase', yaw: angle + Math.PI }); }), i * .4);
    await page.evaluate(n => window.__SS__!.step(n), 8 + Math.floor(random() * 20));
    add(await click(page, 'group', ids[i % 5], parts[i % 4], random, ids));
  }
  // Behind another (0.8 m further from the camera): click the rear one's visible head (above the front one's) or chest.
  for (let i = 0; i < 8; i++) {
    await setup(page, ['weapon.fists']);
    const ids = await page.evaluate((i) => {
      const a = window.__SS__!, cam = a.getState().render.camera, fx = cam.target[0] - cam.position[0], fz = cam.target[2] - cam.position[2], l = Math.hypot(fx, fz);
      const side = (i - 3.5) * .5, base = { x: -fz / l * side + fx / l * 1, z: fx / l * side + fz / l * 1 };
      const front = a.spawn('infected.runner', base, { state: 'idle', yaw: Math.atan2(-fz, fx) });
      // Half hidden: 0.8 m further back and 0.4 m to the side, so its chest shows beside the front one's body.
      const lateral = i % 2 ? 0 : .4, back = a.spawn('infected.runner', { x: base.x + fx / l * .8 - fz / l * lateral, z: base.z + fz / l * .8 + fx / l * lateral }, { state: 'idle', yaw: Math.atan2(-fz, fx) });
      return [front, back];
    }, i);
    await page.evaluate(() => window.__SS__!.step(2));
    add(await click(page, 'behind', ids[1], i % 2 ? 'head' : 'chest', random, ids));
  }

  const result = { rows, summary: summary(rows) };
  mkdirSync('test-results/epics/E05', { recursive: true });
  writeFileSync('test-results/epics/E05/click-attack.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result.summary));
  // Never a move from a click on a drawn infected within reach (PO: the attack click must not move the figure).
  for (const r of rows) if (r.distance <= 1.45 && r.result !== 'move') expect(r.moved, `${r.kind}/${r.part} moved the courier`).toBeLessThan(.05);
  expect(rows.length).toBeGreaterThanOrEqual(80);
  expect(result.summary.missRate, JSON.stringify(result.summary)).toBeLessThanOrEqual(.02);
});
