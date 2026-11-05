// L4 cellar probe: is the cellar interior walkable from the arrival point to the brace? Usage: npx tsx tools/l4/cellar.ts
import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { SimWorld } from '../../src/sim/world/SimWorld';

const world = new SimWorld(); await world.init();
const c = compositions.L4;
world.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
const m = world.loadMission(resolveCampaignMission('L4', world.districts!)); m.begin();
const nav = world.infected!.nav, a = m.def.anchors, inn = a['l4-cellar-in'], brace = a['l4-brace'];
console.log('in', inn.x.toFixed(1), inn.z.toFixed(1), 'clear', nav.clear(inn.x, inn.z, .45), 'brace', brace.x.toFixed(1), brace.z.toFixed(1), 'clear', nav.clear(brace.x, brace.z, .45));
const route = { path: [] as number[], goal: -1, pathIndex: 0 }, wp = { x: 0, z: 0 };
console.log('steer', nav.steer({ x: inn.x, z: inn.z }, brace, route, .45, wp, Infinity, true), 'visible', nav.visible(inn, brace, .3));
for (let z = -2; z <= 8; z += .5) { let line = ''; for (let x = -83; x <= -75; x += .5) line += nav.clear(x, z, .45) ? '.' : '#'; console.log(z.toFixed(1).padStart(5), line); }
