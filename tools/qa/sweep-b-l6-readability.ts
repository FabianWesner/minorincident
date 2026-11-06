/** Current underground PNGs with exact courier and depth-tested crowd-eye masks. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import type { RenderProbes } from '../../src/render/RenderProbes';
import { preset } from '../../src/sim/progression/Campaign';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
const requested = process.argv[2]; if (requested !== 'low' && requested !== 'high') throw new Error('Expected low/high');
const tier: 'low' | 'high' = requested;
const spot = process.argv[3]; if (spot !== 'tunnel' && spot !== 'shelter') throw new Error('Expected tunnel/shelter');
const actorId = Number(process.argv[4] ?? '57'); if (!Number.isInteger(actorId) || actorId <= 0) throw new Error('Expected original actor ID');
const out = `test-results/sweep-b/L6-readability-${tier}-${spot}-${actorId}-repeat`;
mkdirSync(`${out}/captures`, { recursive: true });
const session = new SceneSession({ tier, backend: 'webgl2', query: { profile: '0', ui: '0' } });
try {
  await session.open(); const save = preset('L6-default'); save.settings.quality = tier;
  const state = await session.page.evaluate(async ({ tier, save, spot, actorId }) => {
    const a = window.__SS__!; a.settings.set({ quality: tier }); a.campaign.restore(save); await a.loadLevel('L6', { seed: 1 });
    a.pause(); a.missions.begin(); a.cheats.god(false);
    a.teleport(1, { x: 1.5, z: -2 }); await a.step(1);
    a.cheats.completeObjective('shelter'); a.cheats.completeObjective('stop');
    const at = spot === 'tunnel' ? { x: 110, z: 15 } : { x: 0, z: -4 };
    a.teleport(1, at); a.camera.follow(); a.camera.zoom(1.5);
    const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
    const enemy = w.infected!.active.find(e => e.id === actorId && e.health.current > 0 && !e.hidden && e.infected?.l1)!;
    if (!enemy) throw new Error('No actual breach infected to present');
    a.teleport(enemy.id, { x: at.x + 3.5, z: at.z });
    await a.step(30); enemy.transform.yaw = -Math.PI / 4; g.view.update(1); await a.screenshotReady();
    const probes = (g.view as unknown as { probes: RenderProbes }).probes; probes.setHidden({ courier: false, crowd: false, bars: true }); g.view.update(1); await a.screenshotReady();
    const p = w.entities.get(1)!.transform;
    const ring = Array.from({ length: 64 }, (_, i) => { const angle = i / 64 * Math.PI * 2; const x = p.x + 2 * Math.cos(angle), z = p.z + 2 * Math.sin(angle); const q = a.camera.project(x, p.y - .72, z); return { world: [x, p.y - .72, z], screen: { x: (q[0] + 1) * innerWidth / 2, y: (1 - q[1]) * innerHeight / 2 } }; });
    return { spot, ring, tick: w.tick, tier: w.infected!.director.tier, renderTier: g.view.getState().quality, god: w.combat!.damage.god, player: { ...w.entities.get(1)!.transform }, enemy: { id: enemy.id, archetype: enemy.archetype, at: { ...enemy.transform }, appearance: enemy.appearance, infected: enemy.infected }, figures: a.crowdFigures().filter(f => f.id === enemy.id), lighting: g.view.getState().lighting, camera: g.view.getState().camera, mainPower: w.missions!.state.l6!.mainPower, emergency: w.missions!.state.l6!.emergency, flashlight: w.missions!.state.l6!.flashlight };
  }, { tier, save, spot, actorId });
  const captures: { file: string; sha256: string }[] = [];
  const capture = async (name: string) => { const file = `${out}/captures/${name}.png`; await session.ready(); await session.page.screenshot({ path: file }); captures.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }); };
  await capture('native');
  await session.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game; (g.view as unknown as { probes: RenderProbes }).probes.setHidden({ courier: true, crowd: false, bars: true }); g.view.update(1); });
  await capture('courier-hidden');
  await session.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game, p = (g.view as unknown as { probes: RenderProbes }).probes; p.setHidden({ courier: false, crowd: false, bars: true }); p.idPass = true; g.view.update(1); });
  await capture('courier-id');
  const slots = await session.page.evaluate(async id => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game; (g.view as unknown as { probes: RenderProbes }).probes.idPass = false; g.view.update(1);
    const path = '/tools/qa/sweep-b-actor-mask.ts'; const { installActorMask } = await import(path);
    const mask = installActorMask(g, id); (window as unknown as { sweepActor: ReturnType<typeof installActorMask> }).sweepActor = mask; mask.set(0); return mask.matched;
  }, state.enemy.id);
  await capture('actor-black');
  await session.page.evaluate(() => (window as unknown as { sweepActor: { set(value: number): void } }).sweepActor.set(1));
  await capture('actor-body');
  await session.page.evaluate(() => (window as unknown as { sweepActor: { set(value: number): void } }).sweepActor.set(2));
  await capture('actor-eyes');
  await session.page.evaluate(() => (window as unknown as { sweepActor: { restore(): void } }).sweepActor.restore());
  await capture('native-repeat');
  writeFileSync(`${out}/ledger.json`, JSON.stringify({ ...provenance(), producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l6-readability.ts')).digest('hex'), actorMaskHelperSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-actor-mask.ts')).digest('hex'), slots, method: 'Explicit underground presentation fixture at authored l6-tunnel-retreat x110/z15 or l6-shelter-fails x0/z-4, actual first-breach infected identity moved nearby, mortal player, actual collected headlamp and production second-breach emergency power. Paused exact pose; native lossless PNG then same-pose courier-hidden background and production courier ID pass plus64 ground samples on the actual2m XZ ring. Actual production instance-slot body/eye masks keep all other geometry black/depth-tested; source position/mask nodes preserved, no actor hidden. Rendered original clothes remain in the body mask. Health bars suppressed for scene luminance. No game changes or performance measurements.', state, captures, errors: session.errors }, null, 2)+'\n');
  console.log(tier, spot, state.tier, state.renderTier, state.mainPower, state.emergency, state.flashlight, state.figures.length);
} finally { await session.close(); stopServer(); }
