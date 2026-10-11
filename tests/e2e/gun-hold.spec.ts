import { test, expect } from './fixtures';
import type { ActionView } from '../../src/render/ActionView';

test.use({ viewport: { width: 1280, height: 720 } });

test('@gun-hold selected weapon alone is visible through input, pickup, reload and restore', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?test=1&scenelab=1&renderer=webgl&audio=muted&quality=high&dpr=1');
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  const samples = await page.evaluate(async () => {
    const api = window.__SS__!, lab = window.__SCENE__!;
    await api.ready; api.pause();
    await lab.load({ ground: 'asphalt', size: 80, actors: [{ id: 'courier', kind: 'courier', at: [0, 0], loadout: [['weapon.handgun', 'weapon.pistol'], ['weapon.bat', 'weapon.fire-axe']] }] });
    const samples: { name: string; selected: 'LEFT' | 'RIGHT'; attachments: ReturnType<ActionView['getState']>['attachments'] }[] = [];
    const capture = (name: string) => { const state = api.getState(); samples.push({ name, selected: state.player!.weapons!.selectedSide, attachments: state.render.actions!.attachments }); };
    capture('initial loadout');
    api.input.set({ selectedSlot: { side: 'RIGHT', index: 1 } }); await api.step(1); api.input.clear(); capture('number key axe');
    await api.step(16);
    api.input.set({ selector: 1, selectorActive: true }); await api.step(1); api.input.clear(); capture('wheel');
    await api.step(16);
    api.input.set({ selectedActiveSlot: 0 }); await api.step(1); api.input.clear(); capture('carried number key');
    const pickup = api.spawn('weapon.smg', api.getEntity(1)!.transform);
    await api.step(1); capture('pickup');
    if (api.getEntity(pickup)) throw new Error('Pickup was not collected');
    api.input.set({ selectedSlot: { side: 'LEFT', index: 1 } }); await api.step(16); api.input.clear(); capture('pistol');
    api.input.set({ aim: { x: 1, z: 0 }, left: { down: false, held: true, up: false } });
    await api.step(78); capture('empty magazine reload'); api.input.clear();
    await api.step(60); capture('reloaded');
    // Restore the real sim checkpoint after death, rather than reassigning a rendered slot.
    api.survivor.checkpoint(api.getEntity(1)!.transform);
    api.cheats.god(false); api.survivor.damage(10000); await api.step(180); capture('checkpoint respawn');
    return samples;
  });
  for (const sample of samples) {
    const visible = sample.attachments.filter(a => a.visible);
    expect(visible.length, sample.name).toBeLessThanOrEqual(1);
    expect(sample.attachments.find(a => a.side !== sample.selected)!.visible, sample.name).toBe(false);
    for (const held of visible) {
      expect(held.side, sample.name).toBe(sample.selected);
      expect(held.socket).toBe('weaponSocketR');
      expect(held.gripDistance, sample.name).toBeLessThan(.0001);
    }
  }
});

test('@gun-hold low ready, aim blend, recoil and turning keep the gun fixed to the palm', async ({ page }) => {
  test.setTimeout(process.platform === 'darwin' ? 180_000 : 600_000);
  await page.goto('/?test=1&scenelab=1&renderer=webgl&audio=muted&quality=high&dpr=1');
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  const results = await page.evaluate(async () => {
    const api = window.__SS__!, lab = window.__SCENE__!;
    await api.ready; api.pause();
    const results = [];
    for (const model of ['female', 'male']) for (const gun of ['handgun', 'army-mg']) {
      await lab.load({ ground: 'asphalt', size: 80, actors: [{ id: 'courier', kind: 'courier', at: [0, 0], look: { model }, loadout: [`weapon.${gun}`, 'weapon.bat'] }, { id: 'target', kind: 'infected', at: [30, 0], state: 'idle' }] });
      const idle = api.getState().render.actions!.attachments.find(a => a.visible)!;
      lab.command('courier', { aim: 'target', seconds: 1 });
      const blend = [];
      for (let i = 0; i < 30; i++) { await lab.step(1); blend.push(api.getState().render.actions!.attachments.find(a => a.visible)!.barrel!); }
      lab.command('courier', { attack: 'target', seconds: .4, move: [0, 0] });
      await lab.step(1);
      const firing = api.getState(), shot = firing.render.vfx!.shots.at(-1)!;
      const held = firing.render.actions!.attachments.find(a => a.visible)!;
      lab.command('courier', { run: [[0, 0], [0, 1], [0, -1]], loop: true }); await lab.step(120);
      results.push({ model, gun, idle, blend, held, shot, clipping: await lab.clipping() });
    }
    return results;
  });
  for (const result of results) {
    expect(result.idle.barrel![1]).toBeLessThan(-.5);
    expect(result.blend.at(-1)![1]).toBeGreaterThan(-.001);
    for (let i = 1; i < result.blend.length; i++) expect(Math.hypot(...result.blend[i].map((v, j) => v - result.blend[i - 1][j]))).toBeLessThan(.2);
    expect(result.held.gripDistance).toBeLessThan(.0001);
    expect(Math.hypot(...result.held.muzzle!.map((v, i) => v - result.shot.tracerStart[i]))).toBeLessThan(.05);
    expect(result.held.barrel![0]).toBeGreaterThan(.99);
    expect(result.clipping.summary.gunBodyHits, `${result.model}/${result.gun}: ${JSON.stringify(result.clipping.gunBodies)}`).toBe(0);
  }
});
