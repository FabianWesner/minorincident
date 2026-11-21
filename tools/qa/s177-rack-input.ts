import assert from 'node:assert/strict';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
try {
  for (const { tier, phone } of [{ tier: 'high', phone: false }, { tier: 'low', phone: false }, { tier: 'low', phone: true }] as const) {
    const session = new SceneSession({ backend: 'webgl2', tier, phone, seed: 32, query: { ui: '1' } });
    try {
      await session.open(); await session.page.evaluate('globalThis.__name = fn => fn');
      const initial = await session.page.evaluate(async tier => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
        await a.loadLevel('L10', { seed: 32 }); a.settings.set({ quality: tier }); a.pause(); a.cheats.god(true); a.missions.begin();
        const mission = game.world.missions!;
        for (let i = 0; i < 30 && mission.state.steps.research.status !== 'active'; i++) mission.completeObjective();
        a.teleport(1, { x: 2701, z: 66 }); await a.step(3401); a.teleport(1, { x: 2706, z: 66 }); await a.step(300);
        game.campaignUI.hide(); game.ui.show(null); game.ui.hud.root.dataset.sceneHud = ''; game.ui.update();
        const loadout = game.world.combat!.runner.loadout;
        return { carried: mission.state.states['cure-carried'], ids: loadout.activeEntries().map(entry => entry.id), badges: Array.from(document.querySelectorAll('[data-testid^="weapon-key-"]'), e => e.textContent), visible: getComputedStyle(document.querySelector('[data-testid=weapon-rack]')!).visibility, quality: a.getState().render.quality };
      }, tier);
      assert.equal(initial.carried, true); assert.equal(initial.quality, tier); assert.equal(initial.ids.length, 10); assert.equal(initial.visible, 'visible');
      assert.deepEqual(initial.badges, ['1','2','3','4','5','6','7','8','9','0']);
      const selected = () => session.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game, l = g.world.combat!.runner.loadout; return l.current(l.state.selectedSide).id; });
      const step = () => session.page.evaluate(async () => { await window.__SS__!.step(20); (window.__SCENE__ as unknown as { game: Game }).game.ui.update(); });
      await session.page.keyboard.press('Digit0'); await step(); assert.equal(await selected(), initial.ids[9]);
      await session.page.keyboard.press('KeyQ'); await step(); assert.equal(await selected(), initial.ids[0]);
      await session.page.keyboard.press('Shift+KeyQ'); await step(); assert.equal(await selected(), initial.ids[9]);
      const shotgun = session.page.locator('[data-testid="weapon-rack-weapon.shotgun"]');
      if (phone) await shotgun.tap(); else await shotgun.click();
      await step(); assert.equal(await selected(), 'weapon.shotgun');
      const lureButton = session.page.locator('[data-testid=corgi-lure]');
      if (phone) await lureButton.tap(); else await lureButton.click();
      await step();
      const firstLure = await session.page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.world.combat!.effects.zones.filter(z => z.kind === 'lure').length);
      assert.equal(firstLure, 1);
      await session.page.evaluate(async () => { await window.__SS__!.step(720); (window.__SCENE__ as unknown as { game: Game }).game.ui.update(); });
      await session.page.keyboard.press('KeyG'); await step();
      const lure = await session.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game; return { count: g.world.combat!.effects.zones.filter(z => z.kind === 'lure').length, selected: g.world.combat!.runner.loadout.current(g.world.combat!.runner.loadout.state.selectedSide).id, button: (document.querySelector('[data-testid=corgi-lure]') as HTMLButtonElement).disabled }; });
      assert.equal(lure.count, 1); assert.equal(lure.selected, 'weapon.shotgun'); assert.equal(lure.button, true);
      assert.deepEqual(session.errors, []); console.log(JSON.stringify({ tier, phone, initial, lure, pass: true }));
    } finally { await session.close(); }
  }
} finally { stopServer(); }
