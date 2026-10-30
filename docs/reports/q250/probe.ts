// Run through tools/e2e-lock.sh: npx tsx docs/reports/q250/probe.ts before|after <preview origin>
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from '../../../tools/browser-pool/client';
import { newCampaign, preset } from '../../../src/sim/progression/Campaign';
import { validateSave } from '../../../src/sim/progression/Save';
import type { Game } from '../../../src/Game';

const [phase, origin, only] = process.argv.slice(2), out = `docs/reports/q250/${phase}`;
assert.ok(['before', 'after'].includes(phase)); mkdirSync(out, { recursive: true });
const finished = preset('L10-default');
finished.completedLevels = 10; finished.unlockedLevel = 10;
finished.racks = { LEFT: ['weapon.bat','weapon.fire-axe'], RIGHT: ['weapon.rocket-launcher','weapon.army-mg','weapon.shotgun','weapon.handgun','weapon.pistol','weapon.molotov'] };
finished.ownedActions = [...new Set([...finished.ownedActions, ...finished.racks.LEFT, ...finished.racks.RIGHT])];
finished.selectedAction = 'weapon.army-mg'; finished.settings = { quality: 'low', muted: true };
assert.ok(validateSave(finished));
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'] });
const rows: unknown[] = [];
async function run(name: string, save = finished, debug = false) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); page.setDefaultTimeout(180000);
  if (!name.includes('no-save') && !name.includes('legacy-rack')) await page.addInitScript(s => localStorage.setItem('minor-incident.campaign', JSON.stringify(s)), save);
  try {
    await page.goto(`${origin}/?test=1&ui=1&scenelab=1&preload=0&renderer=webgl&quality=low&audio=muted${debug ? '&debug=1' : ''}`);
    await page.waitForFunction(() => !!window.__SS__); await page.evaluate(() => window.__SS__!.ready);
    if (name === 'menu-L10-to-L2' || name === 'debug-L2') {
      await page.getByTestId('start-game').click(); await page.getByTestId('level-L2').click();
      await page.waitForFunction(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game; return !g.loading && g.world.scenario === 'L2'; });
    } else if (name === 'qa-legacy-rack-L2') {
      await page.evaluate(async () => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game, a = window.__SS__!;
        await a.loadLevel('L1'); a.pause(); a.missions.begin(); a.cheats.god(true); g.ui.show(null);
        for (let i = 0; i < 100 && g.world.missions!.state.phase !== 'result'; i++) {
          if (g.world.missions!.state.phase === 'playing') { try { a.missions.completeObjective(); } catch { /* advance set-piece */ } }
          await a.step(120);
        }
        if (g.world.missions!.state.phase !== 'result') throw new Error('QA L1 did not finish');
        a.missions.continue(); g.ui.update();
      });
      await page.getByTestId('upgrade-health').click();
      await page.getByTestId('rack-RIGHT-0').selectOption('weapon.pistol');
      await page.getByTestId('rack-RIGHT-1').selectOption('weapon.grenade');
      await page.getByTestId('rack-continue').click();
      await page.waitForFunction(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game; return !g.loading && g.world.scenario === 'L2'; });
    } else if (name.startsWith('qa-')) {
      await page.evaluate(async name => { await window.__SS__!.loadLevel(name === 'qa-no-save-L6' ? 'L6' : 'L2', name === 'qa-no-save-L6' ? undefined : { progression: name === 'qa-L2-default' ? 'L2-default' : 'L8-default' }); }, name);
    } else if (name === 'fresh-L1-to-L2') {
      await page.evaluate(async () => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game, a = window.__SS__!;
        await g.startCampaign('female'); a.pause(); a.missions.begin(); a.cheats.god(true);
        for (let i = 0; i < 100 && !['result','progression'].includes(g.world.missions!.state.phase); i++) {
          const m = g.world.missions!;
          if (m.state.phase === 'playing') { try { m.completeObjective(); } catch { /* let the set-piece advance */ } }
          await a.step(120);
        }
        if (g.campaign!.completedLevels !== 1) throw new Error('L1 did not complete');
        await g.continueCampaign(g.campaign!, 2);
      });
    } else {
      await page.evaluate(async ({ s, name }) => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        await g.continueCampaign(s, name === 'carry-handgun-L4' ? 4 : s.unlockedLevel === 2 ? undefined : 2);
      }, { s:save, name });
    }
    await page.evaluate(async () => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game, a = window.__SS__!;
      a.pause(); a.missions.begin(); g.ui.show(null); await a.step(1); g.ui.update(); g.view.update(1);
    });
    const snapshot = async (suffix = '') => {
      const data = await page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game, c = g.world.combat!, s = c.runner.loadout.state;
        return { scenario: g.world.scenario, LEFT: s.LEFT.rack.map(x => x.id), RIGHT: s.RIGHT.rack.map(x => x.id), selected: c.runner.loadout.current(s.selectedSide).id,
          bar: [...document.querySelectorAll<HTMLElement>('.hud-weapon-choice')].map(e => e.dataset.weapon), deaths: g.world.missions!.state.stats.deaths };
      });
      rows.push({ name: name + suffix, ...data }); console.log(name + suffix, JSON.stringify(data));
      const allowed = data.scenario === 'L6' ? ['weapon.fire-axe','weapon.handgun','weapon.army-mg','weapon.shotgun','weapon.assault-rifle'] : data.scenario === 'L4' ? ['weapon.fire-axe','weapon.handgun'] : [];
      if (phase === 'after' && data.scenario === 'L4') assert.equal(data.selected, 'weapon.handgun');
      if (phase === 'after') for (const id of [...data.LEFT, ...data.RIGHT, ...data.bar]) assert.ok(['weapon.bat','weapon.fists','weapon.kick', ...allowed, ...(suffix === '-axe-respawn' ? ['weapon.fire-axe'] : [])].includes(id!), `${name}: unexpected ${id}`);
      return data;
    };
    await snapshot();
    if (name === 'menu-L10-to-L2') {
      await page.screenshot({ path: `${out}/l2-bar.png` });
      const keys = await page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, selected: string[] = [];
        for (let key = 1; key <= 9; key++) { a.input.set({ selectedWeaponKey: key }); await a.step(1); a.input.clear(); const l = g.world.combat!.runner.loadout; selected.push(l.current(l.state.selectedSide).id); }
        return selected;
      });
      rows.push({ name: 'number-keys', selected: keys });
      if (phase === 'after') assert.ok(keys.every(id => ['weapon.bat','weapon.fists','weapon.kick'].includes(id)));
    }
    if (name === 'checkpoint-L2') {
      await page.evaluate(async () => { const a = window.__SS__!; a.missions.checkpoint('axe'); a.survivor.damage(10000); await a.step(300); });
      await snapshot('-respawn');
      await page.evaluate(async () => { const a = window.__SS__!; a.missions.completeObjective('axe'); a.survivor.damage(10000); await a.step(300); });
      const picked = await snapshot('-axe-respawn'); assert.ok([...picked.LEFT,...picked.RIGHT].includes('weapon.fire-axe'));
    }
  } finally { await context.close(); writeFileSync(`${out}/${only ?? 'paths'}.json`, JSON.stringify(rows, null, 2)); }
}
const selectedRun = async (...args: Parameters<typeof run>) => { if (!only || only === args[0]) await run(...args); };
try {
  await selectedRun('menu-L10-to-L2');
  const continuing = preset('L2-default'); continuing.racks = structuredClone(finished.racks); continuing.ownedActions = [...new Set([...continuing.ownedActions, ...finished.ownedActions])]; continuing.settings = finished.settings;
  await selectedRun('continue-L2', continuing);
  await selectedRun('fresh-L1-to-L2', newCampaign());
  const replay = preset('L8-default'); Object.assign(replay, { completedLevels: 5, unlockedLevel: 6, settings: finished.settings, racks: { LEFT: ['weapon.fire-axe','weapon.bat'], RIGHT: ['weapon.army-mg','weapon.handgun','weapon.shotgun','weapon.kick'] } });
  await selectedRun('replay-L2-after-L5', replay);
  await selectedRun('checkpoint-L2');
  await selectedRun('debug-L2', finished, true);
  await selectedRun('qa-L2-default');
  await selectedRun('qa-L8-on-L2');
  await selectedRun('qa-no-save-L6');
  const carrying = structuredClone(finished); carrying.selectedAction = 'weapon.handgun';
  await selectedRun('carry-handgun-L4', carrying);
  await selectedRun('qa-legacy-rack-L2', newCampaign());
} finally { await browser.close(); }
