// r31-aggro: hits-to-kill and aimed-shot hit rate against a standing runner (the suited L4 office infected is an infected.runner,
// look inf.common-worker, 40 hp x INFECTED_TOUGHNESS 1.5 = 60 hp) at 3-8 m, per weapon, Off (straight along facing) and Default assist.
// node --import tsx/esm tools/qa/hit-rate-probe.ts
import { emptyInput, type InputFrame } from '../../src/input/InputFrame';
import { SimWorld } from '../../src/sim/world/SimWorld';

const rows: string[] = [];
const MOVING = process.env.MOVING === '1';
for (const archetype of process.env.ARCH ? process.env.ARCH.split(',') : MOVING ? ['runner', 'sprinter'] : ['runner', 'firefighter', 'armored']) for (const weapon of MOVING ? ['weapon.handgun', 'weapon.army-mg'] : ['weapon.handgun', 'weapon.army-mg', 'weapon.shotgun']) for (const setting of ['Off', 'Default'] as const) for (const distance of MOVING ? [8, 12] : [3, 5, 8]) {
  let totalShots = 0, totalHits = 0, kills = 0, hitsToKill = 0, trials = 0;
  for (let offset = -0.4; offset <= 0.41; offset += 0.2) { // lateral aim error in metres (stands off the aim line)
    const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1); w.combat!.damage.god = true;
    w.combat!.setLoadout(['weapon.bat'], [weapon]); w.combat!.assist.setting = setting;
    const p = w.entities.get(1)!; p.transform.yaw = 0;
    const id = w.infected!.spawn(`infected.${archetype}`, { x: p.transform.x + distance, z: p.transform.z + offset }, { state: MOVING ? 'chase' : 'idle', ...(archetype === 'alpha' ? { alphaType: (process.env.ALPHA ?? 'brute') as 'brute' } : {}) });
    const e = w.entities.get(id)!; const maxHp = e.health.current;
    const start = w.events.events().length;
    for (let t = 0; t < (archetype === 'alpha' ? 1800 : 360) && e.health.current > 0 && !(MOVING && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 1.2); t++) {
      const f: InputFrame = emptyInput(); f.aimSource = 'assist'; f.right = { down: t === 0, held: true, up: false };
      w.applyInput(f, 'keyboard'); w.update();
    }
    const ev = w.events.events().slice(start);
    const shots = ev.filter(x => x.type === 'combat.attack' && x.sourceId === 1).length, hits = ev.filter(x => x.type === 'combat.hit' && x.sourceId === 1 && x.targetId === id).length;
    totalShots += shots; totalHits += hits; trials++; if (e.health.current <= 0) { kills++; hitsToKill += hits; }
    void maxHp; w.dispose();
  }
  rows.push(`${archetype.padEnd(11)} ${weapon.padEnd(15)} ${setting.padEnd(7)} ${distance} m  kills ${kills}/${trials}  hit-rate ${(totalHits / Math.max(1, totalShots) * 100).toFixed(0)}% (${totalHits}/${totalShots})  hits-to-kill ${kills ? (hitsToKill / kills).toFixed(1) : '-'}`);
  console.log(rows[rows.length - 1]);
}
process.exit(0);
