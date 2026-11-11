/* eslint-disable @typescript-eslint/no-explicit-any -- diagnostic (r42-arenas) */
// L4 retreat pocket: ASCII of the admission nav and the wide-body nav around the supermarket (5.9, 36.4); then a brute + riot are put 5 m from
// the courier and the probe measures whether they reach her. Usage: tsx l4-pocket-probe.ts [x0 z0 x1 z1] [fix]
import { readFileSync } from 'node:fs';
import { emptyInput } from '../../../src/input/InputFrame';
import { compositions } from '../../../src/levels/compositions';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { preset } from '../../../src/sim/progression/Campaign';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { missionControls } from '../../../src/sim/missions/controls';
import { SimWorld } from '../../../src/sim/world/SimWorld';
const w: any = new SimWorld(); await w.init();
const c = compositions.L4;
w.loadComposition(c, c.districts.map((d: any) => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), Number(process.env.TIER ?? 0));
applyCampaign(w, preset('L4-default'));
const m = w.loadMission(resolveCampaignMission('L4', w.districts!)); m.begin(); m.loadCheckpoint('line-break');
for (let i = 0; i < 5; i++) w.update();
const inf = w.infected, admission = inf.navigation.fallback, wide = inf.wideNav;
const [x0, z0, x1, z1] = [Number(process.argv[2] ?? -2), Number(process.argv[3] ?? 26), Number(process.argv[4] ?? 14), Number(process.argv[5] ?? 42)];
const draw = (nav: any, label: string) => {
  console.log(label, 'x', x0, '..', x1, 'z', z0, '..', z1);
  for (let z = z0; z <= z1; z += .5) { let row = z.toFixed(1).padStart(6) + ' '; for (let x = x0; x <= x1; x += .5) { const cell = nav.cell(x, z); row += cell < 0 ? '?' : nav.blocked[cell] ? '#' : '.'; } console.log(row); }
};
draw(admission, 'admission'); draw(wide, 'wide');
const pe = w.entities.get(1), p = pe.transform;
const spots = (process.env.SPAWN ?? '5.9,31.4;7.2,31.6').split(';').map(t => t.split(',').map(Number));
missionControls(w).teleport(1, { x: 5.9, z: 36.4 }); console.log('courier pose', p);
if (Math.hypot(p.x - 5.9, p.z - 36.4) > .05) throw new Error('Pocket placement failed');
for (const e of w.infected.active.slice()) { e.health.current = 0; }
const ids = [['infected.brute', spots[0]], ['infected.riot', spots[1]]].map(([a, [x, z]]: any) => { const id = w.infected.spawn(a, { x, z }, { yaw: 0 }); return id; });
w.combat.damage.god = false;
for (const id of ids) w.infected.press(id, 1, w.tick + 3600);
for (let t = 0; t < 1200; t++) {
  const f = emptyInput(); w.applyInput(f, 'keyboard'); w.update();
  if (t % 200 === 0) console.log(t, 'HP', pe.health.current, ids.map(id => { const e = w.entities.get(id); return e ? `${e.archetype} ${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)} ${e.infected?.state} d=${Math.hypot(e.transform.x - p.x, e.transform.z - p.z).toFixed(1)}` : '-'; }).join(' | '));
}
w.dispose();
