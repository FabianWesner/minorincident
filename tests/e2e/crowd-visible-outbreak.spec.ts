import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test, testUrl } from './fixtures';

// P1 guard (PO "There is an invisible zombie biting me"): a running figure whose crowd footwork started with both feet
// in swing got a NaN pelvis, so its pose went non-finite and the GPU drew nothing for seconds while the sim kept it
// attacking. Through an L1 outbreak with bat fights, bites, transformations, corpses and the house emergence, every
// living infected and pedestrian on screen within 20 m of the courier must be drawn every frame by a live (not
// corpse) crowd instance with a finite pose at its sim position, on WebGL2 and WebGPU.
test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });

for (const renderer of ['webgl', 'webgpu'] as const) {
  test(`T-E07-crowd-visible-outbreak-${renderer} @E07 every on-screen living infected and pedestrian is drawn through an L1 outbreak fight (${renderer})`, async ({ page }) => {
    test.setTimeout(180_000);
    if (renderer === 'webgpu') {
      await page.goto('/');
      const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
      test.skip(!adapter && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
    }
    await boot(page, testUrl.replace('renderer=webgl', `renderer=${renderer}`));
    const result = await page.evaluate(async (seconds) => {
      const a = window.__SS__!;
      // The bat checkpoint: the courier leaves the garage armed, which also starts the house emergence.
      await a.loadLevel('L1', { seed: 1, checkpoint: 'bat' });
      a.pause(); a.cheats.god(true); a.camera.follow(); a.setLoadout(['weapon.bat'], ['weapon.fists']);
      // Walkers (not seated routines, whose figure slides to its seat) gather in front of the courier: the infected
      // bite them, they turn on screen, the courier bats the infected into corpses.
      const me = a.getEntity(1)!.transform;
      const walkers = a.query({ kind: 'civilian' }).filter(e => !e.hidden && e.health.current > 0 && !e.civilian?.pet && !e.civilian?.schedule?.some(s => s.seat));
      for (const [i, c] of walkers.slice(0, 16).entries()) a.teleport(c.id, { x: me.x + 3 + i % 4 * 1.5, z: me.z - 4 + Math.floor(i / 4) * 1.5 });
      const start = a.tick(), misses: object[] = [];
      let frames = 0, samples = 0, infectedSamples = 0, missed = 0, lastTick = start;
      const began = performance.now(); a.resume();
      while (performance.now() - began < seconds * 1000) {
        await new Promise(requestAnimationFrame); frames++;
        const player = a.getEntity(1)!.transform;
        if (frames % 20 === 0) {
          const near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && !e.corpse).map(e => ({ e, d: Math.hypot(e.transform.x - player.x, e.transform.z - player.z) })).sort((x, y) => x.d - y.d)[0];
          if (near && near.d < 5) a.input.set({ attackTarget: { id: near.e.id, side: 'LEFT' } });
          else if (near && frames % 120 === 0) a.input.set({ moveTarget: { x: near.e.transform.x, z: near.e.transform.z } });
        }
        // Live crowd figures drawn last frame (static corpse pages carry an instanceKey and never count).
        const drawn = new Map<number, number[][][]>();
        for (const f of a.crowdFigures()) if (f.drawn && !f.instanceKey) drawn.set(f.id, [...(drawn.get(f.id) ?? []), f.feet]);
        for (const e of [...a.query({ kind: 'infected' }), ...a.query({ kind: 'civilian' })]) {
          if (e.hidden || e.infected?.hidden || e.civilian?.pet || e.corpse || e.health.current <= 0 || e.archetype === 'infected.crow') continue;
          if (e.civilian && (e.civilian.state === 'infected' || e.civilian.state === 'finished')) continue;
          if (Math.hypot(e.transform.x - player.x, e.transform.z - player.z) > 20) continue;
          const p = a.camera.project(e.transform.x, e.transform.y, e.transform.z);
          if (Math.abs(p[0]) > .95 || Math.abs(p[1]) > .95 || p[2] > 1) continue;
          samples++; if (e.infected) infectedSamples++;
          const figures = drawn.get(e.id) ?? [];
          // A drawn figure must have finite feet near its sim position (a NaN pose draws no pixels).
          const offset = Math.min(Infinity, ...figures.map(feet => feet.flat().every(Number.isFinite) && feet[0]?.length ? Math.hypot(feet[0][0] - e.transform.x, feet[0][2] - e.transform.z) : Infinity));
          if (!(offset <= 2.5)) {
            missed++;
            if (misses.length < 40) misses.push({ tick: a.tick(), id: e.id, kind: e.kind, figures: figures.length, offset, state: e.infected?.state ?? e.civilian?.state });
          }
        }
        lastTick = a.tick();
      }
      a.pause(); a.input.clear();
      const events = a.events(start);
      return {
        backend: a.perf().backend, frames, ticks: lastTick - start, samples, infectedSamples, missed, misses,
        attacks: events.filter(e => e.type === 'infected.attack' && e.targetId === 1).length,
        turned: events.filter(e => e.type === 'civilian.turned').length,
        kills: events.filter(e => e.type === 'combat.kill').length,
        doors: events.filter(e => e.type === 'gate.changed' && String((e as { id: string }).id).startsWith('door-')).length,
      };
    }, 40);
    const dir = 'test-results/epics/E07/crowd-visible-outbreak'; mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${renderer}.json`, JSON.stringify(result, null, 2) + '\n');
    expect(result.backend).toBe(renderer);
    expect(result.infectedSamples, 'on-screen infected samples').toBeGreaterThan(300);
    expect(result.attacks, 'infected strikes on the courier').toBeGreaterThan(0);
    expect(result.turned, 'bitten pedestrians who turned').toBeGreaterThan(0);
    expect(result.kills, 'infected the bat turned into corpses').toBeGreaterThan(0);
    expect(result.doors, 'house emergence doors').toBeGreaterThan(0);
    expect(result.misses, 'living figures in view that drew nothing (or a non-finite pose)').toEqual([]);
  });
}
