/** Physical keyboard/mouse route samples. The native bot supplies advice only;
 * Game.driver stays null and no frame is injected into the simulation. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { weaponKey } from '../../src/data/weaponKeys';
import type { InputFrame } from '../../src/input/InputFrame';
import type { Game } from '../../src/Game';

type Audit = { shots: number; kills: number; rejected: number; deaths: number };
type Scope = { planner: { sample(): InputFrame }; audit: Audit };
const out = 'test-results/r12-l7/live'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'low', viewport: { width: 1280, height: 800 }, seed: 1 });
const rows: unknown[] = [];
let held: string[] = [], firing = false;
async function keys(next: string[]) {
  for (const k of held) if (!next.includes(k)) await session.page.keyboard.up(k);
  for (const k of next) if (!held.includes(k)) await session.page.keyboard.down(k);
  held = next;
}
async function fire(on: boolean) {
  if (on === firing) return;
  if (on) await session.page.mouse.down(); else await session.page.mouse.up();
  firing = on;
}
try {
  await session.open();
  for (const tier of ['low', 'high'] as const) {
    await keys([]); await fire(false);
    await session.page.evaluate(async tier => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      g.params.set('quality', tier); a.settings.set({ quality: tier });
      await a.loadLevel('L7', { seed: 1, progression: 'L7-default' }); a.pause(); a.camera.follow(); a.camera.zoom(1.5);
      a.bot.start('complete');
      const scope = window as unknown as Scope;
      scope.planner = g.driver!; a.bot.stop();
      scope.audit = { shots: 0, kills: 0, rejected: 0, deaths: 0 };
      g.world.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.rocket-launcher') scope.audit.shots++; });
      g.world.events.on('combat.kill', e => { if (e.type === 'combat.kill' && e.sourceId === 1 && e.actionId === 'weapon.rocket-launcher' && g.world.entities.get(e.targetId)?.faction === 'infected') scope.audit.kills++; });
      g.world.events.on('combat.empty', e => { if (e.type === 'combat.empty' && e.reason === 'too-close') scope.audit.rejected++; });
      g.world.events.on('player.died', () => scope.audit.deaths++);
    }, tier);
    await session.page.addStyleTag({ content: '#hud,.hud,.story-bubble,.mission-subtitle,[data-testid=mission-button]{visibility:visible!important}' });
    const phase = await session.page.evaluate(() => window.__SS__!.missions.state()?.phase);
    if (phase === 'briefing') await session.page.getByTestId('mission-button').click({ force: true });
    let photographed = false, closeProof: unknown = null, end: unknown = null;
    for (let i = 0; i < 1800; i++) {
      const plan = await session.page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, scope = window as unknown as Scope;
        const p = w.entities.get(1)!, f = scope.planner.sample(), az = g.view.view.azimuth;
        const x = Math.cos(az) * f.move.x - Math.sin(az) * f.move.z, y = Math.sin(az) * f.move.x + Math.cos(az) * f.move.z;
        const keys: string[] = [];
        if (Math.abs(x) > .35) keys.push(x > 0 ? 'KeyD' : 'KeyA');
        if (Math.abs(y) > .35) keys.push(y > 0 ? 'KeyS' : 'KeyW');
        const point = f.aimPoint, projected = point ? g.view.project(point.x, w.districts!.groundHeight(point.x, point.z), point.z) : null;
        const slot = f.selectedSlot, selected = slot ? p.weapons![slot.side].rack[slot.index].id : null;
        return { tick: w.tick, hp: p.health.current, position: { x: p.transform.x, z: p.transform.z }, god: w.combat!.damage.god,
          driverInjected: g.driver !== null, stats: { ...scope.audit }, boarded: w.l7Departure!.state.boarded.length,
          finished: w.l7Departure!.state.phase === 'done', owned: w.combat!.runner.loadout.activeEntries().some(e => e.id === 'weapon.rocket-launcher'),
          selected, current: w.combat!.runner.loadout.current(p.weapons!.selectedSide).id,
          keys, interact: f.interact, fire: f.left.held || f.left.down || f.right.held || f.right.down,
          projected: projected && Math.abs(projected[0]) < .95 && Math.abs(projected[1]) < .9 ? { x: (projected[0] + 1) * 640, y: (1 - projected[1]) * 400 } : null };
      });
      assert.equal(plan.driverInjected, false); assert.equal(plan.god, false); end = plan;
      if (plan.finished || plan.hp <= 0 || plan.tick >= 10800) break;
      if (tier === 'low' && plan.owned && !closeProof) {
        await keys([]); await fire(false); await session.page.keyboard.press('Digit7');
        await session.page.evaluate(async () => {
          const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world, l = w.combat!.runner.loadout;
          const wait = Math.max(l.state.RIGHT.swapUntil, l.current('RIGHT').readyAt) - w.tick;
          await a.step(Math.max(8, wait + 8));
        });
        const near = await session.page.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game, p = g.world.entities.get(1)!.transform;
          const q = g.view.project(p.x - 2, g.world.districts!.groundHeight(p.x - 2, p.z), p.z);
          return { x: (q[0] + 1) * 640, y: (1 - q[1]) * 400, shots: (window as unknown as Scope).audit.shots };
        });
        await session.page.mouse.move(near.x, near.y); await fire(true); await session.page.evaluate(() => window.__SS__!.step(16)); await fire(false);
        closeProof = await session.page.evaluate(() => ({ ...(window as unknown as Scope).audit, hint: document.querySelector('.hud-weapon-hint')?.textContent }));
        assert.equal((closeProof as Audit).shots, near.shots); assert.ok((closeProof as Audit).rejected > 0);
        assert.equal((closeProof as { hint: string }).hint, 'Too close!');
        await session.ready(); await session.page.screenshot({ path: `${out}/low-too-close.jpg`, type: 'jpeg', quality: 75 });
      }
      const shortcut = plan.selected && weaponKey(plan.selected);
      if (shortcut && plan.current !== plan.selected) await session.page.keyboard.press(`Digit${shortcut}`);
      await keys(plan.keys);
      if (plan.interact) await session.page.keyboard.press('KeyE');
      if (plan.projected) await session.page.mouse.move(plan.projected.x, plan.projected.y);
      await fire(!!plan.projected && plan.fire);
      await session.page.evaluate(() => window.__SS__!.step(6));
      if (!photographed && plan.stats.shots >= 10) {
        await session.ready(); await session.page.screenshot({ path: `${out}/${tier}-combat.jpg`, type: 'jpeg', quality: 75 }); photographed = true;
      }
    }
    await keys([]); await fire(false);
    rows.push({ tier, seed: 1, method: 'Native planner advice translated to physical WASD, number keys, E and mouse. Six fixed ticks per observation. No teleport, god mode, input injection or objective skip.', closeProof, end });
    writeFileSync('docs/reports/r12-l7/physical.json', JSON.stringify({ rows, browserErrors: session.errors }, null, 2) + '\n');
    console.log(JSON.stringify({ tier, end }));
  }
  assert.equal(session.errors.length, 0);
} finally { await keys([]).catch(() => {}); await fire(false).catch(() => {}); await session.close(); stopServer(); }
