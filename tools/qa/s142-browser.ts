import { writeFileSync, mkdirSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { readFixture } from './fixture-io';
import { loadFixtureInPage } from './load-fixture';
import type { Game } from '../../src/Game';
const out = 'test-results/s142-direct'; mkdirSync(out, { recursive: true });
const rows = [];
for (const tier of ['high', 'low'] as const) {
 const session = new SceneSession({ backend: 'webgl2', tier });
 try {
 await session.open();
 const fixture = readFixture('tests/fixtures/saves/qa/s142-l3-bridge-pointblank.json.gz'); fixture.campaign.settings.quality = tier;
 await loadFixtureInPage(session.page, fixture);
 const setup = await session.page.evaluate(() => {
 const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, p = w.entities.get(1)!;
 w.combat!.setLoadout(['weapon.handgun'], ['weapon.fire-axe']);
 const id = w.infected!.spawn('infected.runner', { x: p.transform.x + .8, z: p.transform.z });
 const e = w.entities.get(id)!;
 window.__SS__!.input.set({ aim: { x: 1, z: 0 }, aimPoint: { x: e.transform.x, z: e.transform.z }, left: { down: true, held: true, up: false } });
 return { id, hp: e.health.current, player: { ...p.transform }, target: { ...e.transform } };
 });
 await session.page.evaluate(async () => { await window.__SS__!.step(480); });
 const result = await session.page.evaluate(id => ({ target: window.__SS__!.getEntity(id), hits: window.__SS__!.events().filter(e => e.type === 'combat.hit' && e.sourceId === 1) }), setup.id);
 rows.push({ tier, setup, hp: result.target?.health.current, hits: result.hits, errors: session.errors });
 await session.page.screenshot({ path: `${out}/${tier}.jpg`, type: 'jpeg', quality: 65 });
 if (!result.target || result.target.health.current >= setup.hp) throw new Error(`${tier}: target took no damage`);
 } finally { await session.close(); }
}
stopServer(); writeFileSync(`${out}/rows.json`, JSON.stringify(rows, null, 2)); console.log(JSON.stringify(rows));
