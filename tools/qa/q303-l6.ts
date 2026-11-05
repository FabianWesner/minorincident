/** L6 UAT 10-31 checks on the production L6 mission (Scene Lab l6Subway fixtures):
 *  - Q-303 headlamp: WASD + mouse aim, walking east while aiming north (strafe) and backpedalling; the beam must follow the head.
 *  - Q-304 shelter: resting/sitting residents who carry a rifle from L5 (armed through Pickups.armSurvivor, routine kept).
 *  - Q-305 gate: everyone through gate 90 with the leader already past it; the gate offers its prompt, a click closes it.
 * SCENE_PORT=4898 E2E_PORT=4897 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/q303-l6.ts <outDir> [high|low] [lamp,shelter,gate]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

const out = process.argv[2] ?? 'test-results/q303-l6';
const tier = (process.argv[3] ?? 'high') as 'high' | 'low';
const parts = (process.argv[4] ?? 'lamp,shelter,gate').split(',');
mkdirSync(out, { recursive: true });
const base = JSON.parse(readFileSync('tests/scenes/catalog/qa-l6-po-headlamp.json', 'utf8')) as SceneSpec;
const rows: Record<string, unknown> = {};
const s = new SceneSession({ tier, backend: 'webgpu', viewport: { width: 1000, height: 700 }, deviceScaleFactor: 2 });
const zoomTo = (z: number) => s.page.evaluate(async z => {
  const a = window.__SS__!, rig = (window.__SCENE__ as unknown as { game: Game }).game.view.view;
  rig.zoom(Math.log(z / rig.getState().targetZoom), true); await a.step(2); await a.screenshotReady();
}, z);
const shot = (name: string) => s.page.screenshot({ path: `${out}/${tier}-${name}.jpg`, type: 'jpeg', quality: 82 });
try {
  await s.open();
  await s.page.evaluate('globalThis.__name = (fn) => fn');
  if (parts.includes('lamp')) for (const [name, move] of [['strafe', [1, 0]], ['backpedal', [0, 1]]] as const) {
    // Aim target north of the courier (screen up-right), walking east (strafe) or south (backpedal) with the beam on.
    await s.load({ ...base, name: `q303-${name}`, frames: 0, shots: [],
      actors: [{ id: 'courier', kind: 'courier', at: [2, -2], loadout: ['weapon.fire-axe', 'weapon.handgun'] }, { id: 'target', kind: 'infected', at: [2, -9], archetype: 'infected.runner', state: 'idle' }],
      script: [{ frame: 2, actor: 'courier', do: { select: 'RIGHT', index: 0 } }, { frame: 4, actor: 'courier', do: { aim: 'target', seconds: 6, move: [...move], strafe: true } }],
      camera: { mode: 'follow', actor: 'courier', zoom: 1 } } as unknown as SceneSpec);
    await s.page.evaluate(() => { const w = (window.__SCENE__ as unknown as { game: Game }).game.world; if (w.missions?.state.l6) w.missions.state.l6.flashlight = true; });
    await s.step(70);
    const m = await s.page.evaluate(async () => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
      const p = w.entities.get(1)!.transform, t = a.query({}).find(e => e.infected)!.transform;
      const v = g.view as unknown as { lighting: { headlampAim: { value: { x: number; y: number } } }; character: { headYaw(): number } }, aim = v.lighting.headlampAim.value, head = v.character.headYaw();
      const toTarget = -Math.atan2(t.z - p.z, t.x - p.x), beam = Math.atan2(-aim.y, aim.x), deg = (r: number) => Math.round(r * 180 / Math.PI);
      const diff = (u: number, v: number) => Math.abs(deg(Math.atan2(Math.sin(u - v), Math.cos(u - v))));
      return { simYaw: deg(p.yaw), toTarget: deg(toTarget), beam: deg(beam), head: deg(head), beamVsTarget: diff(beam, toTarget), beamVsHead: diff(beam, head) };
    });
    console.log(name, JSON.stringify(m)); rows[name] = m;
    for (const z of [1.5, 0.5]) { await zoomTo(z); await shot(`lamp-${name}-z${z}`); }
  }
  if (parts.includes('shelter')) {
    // Shelter residents in their routines, each carried in with an L5 rifle (resting = lying, sitting on the benches).
    await s.load({ ...base, l6Subway: 'pickup', name: 'q304-shelter', frames: 0, shots: [], actors: [{ id: 'courier', kind: 'courier', at: [-7.35, -5.01] }], camera: { mode: 'follow', actor: 'courier', zoom: 1 } } as unknown as SceneSpec);
    const m = await s.page.evaluate(async () => {
      const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world, l6 = w.missions!.state.l6!;
      const armed: unknown[] = [];
      for (const r of l6.survivors) {
        const e = w.entities.get(r.id)!, c = e.civilian!; if (!['rest', 'sit', 'treat'].includes(r.routine)) continue;
        const story = c.story, schedule = c.schedule, step = c.scheduleStep, until = c.activityUntil, started = c.activityStarted;
        w.combat!.pickups.spawn('weapon.hunting-rifle', { x: e.transform.x, z: e.transform.z }, false, { survivorOnly: true });
        const ok = w.combat!.pickups.armSurvivor(e);
        // Carried residents keep their shelter routine (LevelSixSubway restores the story after readyCarriedAlly).
        Object.assign(c, { story, schedule, scheduleStep: step, activityUntil: until, activityStarted: started });
        armed.push({ key: r.key, routine: r.routine, ok, x: +e.transform.x.toFixed(1), z: +e.transform.z.toFixed(1) });
      }
      await a.step(90);
      return armed;
    });
    console.log('shelter', JSON.stringify(m)); rows.shelter = m;
    const spots = (m as { routine: string; x: number; z: number }[]).filter(r => r.routine !== 'treat').slice(0, 2);
    for (const spot of spots) {
      await s.page.evaluate(async p => { const a = window.__SS__!; a.teleport(1, { x: p.x + 1.8, z: p.z + 1.6 }); await a.step(3); }, spot);
      for (const z of [1.5, 0.5]) { await zoomTo(z); await shot(`shelter-${spot.routine}-${spot.x}-z${z}`); }
    }
  }
  if (parts.includes('gate')) {
    // The whole group is through gate 90 and the scripted leader already walks on (x 105): the old guide had moved its
    // waypoint off this gate, so the prompt was gone exactly when the gate could close.
    const gateSpec = JSON.parse(readFileSync('tests/scenes/catalog/qa-l6-po-gate.json', 'utf8')) as SceneSpec;
    await s.load({ ...gateSpec, l6Subway: 'entry', name: 'q305-gate', frames: 0, shots: [], camera: { mode: 'follow', actor: 'courier', zoom: 1 }, actors: [{ id: 'courier', kind: 'courier', at: [91.2, 16.15], loadout: ['weapon.fire-axe', 'weapon.army-mg'] }] } as unknown as SceneSpec);
    const before = await s.page.evaluate(async () => {
      const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world, m = w.missions!;
      await a.step(10); await a.screenshotReady();
      const panel = document.querySelector('[data-testid="interaction-prompt"]') as HTMLElement | null;
      return { marker: m.state.marker, next: m.def.anchors['l6-next'], gate: m.state.l6!.gates[0], panel: panel && !panel.hidden ? panel.innerText.replace(/\s+/g, ' ') : null };
    });
    console.log('gate-before', JSON.stringify(before)); rows.gateBefore = before;
    for (const z of [1.5, 0.5]) { await zoomTo(z); await shot(`gate-prompt-z${z}`); }
    // A click on the gate (moveTarget on the gate line): the courier closes it without E.
    const after = await s.page.evaluate(async () => {
      const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world, m = w.missions!;
      a.input.set({ moveTarget: { x: 90.2, z: 15 } }); await a.step(1); a.input.clear();
      await a.step(90); await a.screenshotReady();
      const panel = document.querySelector('[data-testid="interaction-prompt"]') as HTMLElement | null;
      return { marker: m.state.marker, next: m.def.anchors['l6-next'], gate: m.state.l6!.gates[0], objective: document.querySelector('[data-objective], .objective, .tracker')?.textContent?.replace(/\s+/g, ' ') ?? null, panel: panel && !panel.hidden ? panel.innerText.replace(/\s+/g, ' ') : null };
    });
    console.log('gate-after', JSON.stringify(after)); rows.gateAfter = after;
    for (const z of [1.5, 0.5]) { await zoomTo(z); await shot(`gate-closed-z${z}`); }
  }
} finally { writeFileSync(`${out}/rows-${tier}-${parts.join('-')}.json`, JSON.stringify(rows, null, 1)); await s.close(); stopServer(); }
