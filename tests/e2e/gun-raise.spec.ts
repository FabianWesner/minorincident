import { test, expect } from './fixtures';

test('@E05 @gun-raise first idle and walking tap blends before muzzle discharge', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?test=1&scenelab=1&renderer=webgl&audio=muted&quality=high&dpr=1');
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  const cases = await page.evaluate(async () => {
    const api = window.__SS__!, lab = window.__SCENE__!;
    await api.ready; api.pause();
    const cases = [];
    for (const walk of [false, true]) {
      await lab.load({ ground: 'asphalt', size: 80, actors: [{ id: 'courier', kind: 'courier', at: [0, 0], loadout: ['weapon.handgun', 'weapon.bat'] }, { id: 'target', kind: 'infected', at: [10, 0], state: 'idle' }] });
      if (walk) { lab.command('courier', { walk: [[0, 0], [0, 5]] }); await lab.step(20); }
      lab.command('courier', { attack: 'target', seconds: 1 / 60, move: walk ? [0, .5] : [0, 0] });
      const samples = [];
      for (let i = 0; i < 9; i++) {
        await lab.step(1);
        const s = api.getState(), v = s.player!.survivor!.velocity;
        samples.push({ tick: s.tick, speed: Math.hypot(v.x, v.z), attachments: s.render.actions!.attachments, shot: s.render.vfx!.shots.at(-1) ?? null });
        if (walk && i === 0) lab.command('courier', { walk: [[0, 0], [0, 5]] });
      }
      cases.push({ walk, samples });
    }
    return cases;
  });
  for (const c of cases) {
    for (const s of c.samples) {
      expect(s.attachments.filter(a => a.visible)).toHaveLength(1);
      expect(s.attachments.find(a => a.side === 'RIGHT')!.visible).toBe(false);
      expect(s.attachments.find(a => a.visible)!.gripDistance).toBeLessThan(.0001);
    }
    const held = c.samples.map(s => s.attachments.find(a => a.visible)!);
    expect(held[0].barrel![1]).toBeLessThan(-.5);
    for (let i = 1; i <= 6; i++) {
      expect(held[i].barrel![1]).toBeGreaterThanOrEqual(held[i - 1].barrel![1] - .0001);
      expect(Math.abs(held[i].barrel![1] - held[i - 1].barrel![1])).toBeLessThan(.2);
    }
    for (const s of c.samples.slice(0, 6)) expect(s.shot).toBeNull();
    const s = c.samples[6]; expect(s.shot!.tick - c.samples[0].tick).toBe(6);
    expect(held[6].barrel![1]).toBeGreaterThan(-.001);
    if (c.walk) expect(s.speed).toBeGreaterThan(.1);
    expect(Math.hypot(...held[6].muzzle!.map((v, i) => v - s.shot!.tracerStart[i]))).toBeLessThan(.05);
  }
});
