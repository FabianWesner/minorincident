import { emptyInput, type InputFrame } from '../../input/InputFrame';
import { l8BossArenas, type L8BossId } from '../../data/l8Bosses';
import type { SimWorld } from '../../sim/world/SimWorld';
import { Walker } from './Walker';
import { strikeAt } from './helpers';
/** Uses visible windups and ordinary movement/weapon input; there is no damage or mission-state assistance. */
export class L8ArenaBot {
  private readonly walker = new Walker();
  private readonly entered = new Set<L8BossId>();
  constructor(private readonly w: SimWorld) {}
  sample(id: L8BossId, policy: 'skilled' | 'passive' | 'standing' | 'kite' = 'skilled'): InputFrame {
    const w = this.w, f = emptyInput(), p = w.entities.get(1)!, zoo = w.missions!.l8!;
    const arena = zoo.state.arenas.find(a => a.id === id)!, def = l8BossArenas.find(a => a.id === id)!;
    if (p.health.current <= 0) return f;
    if (!arena.phase) {
      if (Math.hypot(p.transform.x - def.entry.x, p.transform.z - def.entry.z) < 2) this.entered.add(id);
      f.move = this.walker.step(w, this.entered.has(id) ? def.centre : def.entry, this.entered.has(id) ? 5 : 1, `arena-${id}-${this.entered.has(id)}`) ?? f.move; return f;
    }
    if (policy === 'passive') return f;
    const enemies = arena.ids.map(id => w.entities.get(id)).filter(e => e?.infected && e.health.current > 0 && !e.infectionRise &&
      !(arena.phase === 1 && (id === 'lion' && e.infected.arenaBoss?.slot === 1 || id === 'monkey' && e.infected.arenaBoss?.slot === 6)));
    const targets = enemies.filter(e => w.combat!.query.visible(p.transform, e!.transform));
    targets.sort((a, b) => {
      if (id === 'monkey' && arena.phase === 2) return (b!.infected!.arenaBoss!.slot === 6 ? 1 : 0) - (a!.infected!.arenaBoss!.slot === 6 ? 1 : 0);
      return (w.tick < b!.infected!.arenaBoss!.exposedUntil ? 1 : 0) - (w.tick < a!.infected!.arenaBoss!.exposedUntil ? 1 : 0) || Math.hypot(a!.transform.x - p.transform.x, a!.transform.z - p.transform.z) - Math.hypot(b!.transform.x - p.transform.x, b!.transform.z - p.transform.z);
    });
    const target = targets[0];
    if (target) {
      const grabbed = policy === 'skilled' && zoo.bosses.swapBlocked();
      const action = grabbed ? 'weapon.fire-axe' : 'weapon.army-mg';
      const choice = w.combat!.runner.loadout.activeEntries().find(e => e.id === action)!;
      if (choice) { f.selectedSlot = { side: choice.side, index: choice.index }; strikeAt(f, target, choice.side, p.transform, false); if (grabbed) f[choice.side === 'LEFT' ? 'left' : 'right'].down = true; }
    }
    if (policy === 'standing') return f;
    if (policy === 'kite') {
      const dx = p.transform.x - def.centre.x, dz = p.transform.z - def.centre.z, d = Math.hypot(dx, dz) || 1;
      f.move = { x: -dz / d + dx / d * (10 - d) * .12, z: dx / d + dz / d * (10 - d) * .12 }; return f;
    }
    const tells = enemies.filter(e => e!.infected!.specialAttack?.stage === 'telegraph' || e!.infected!.specialAttack?.stage === 'active');
    const dangerous = tells.find(e => {
      const a = e!.infected!.specialAttack!;
      if (a.stage === 'recovery') return false;
      const dx = p.transform.x - a.area.x, dz = p.transform.z - a.area.z, cross = Math.abs(dx * a.area.dz - dz * a.area.dx), along = dx * a.area.dx + dz * a.area.dz;
      return ['gorilla.roar', 'gorilla.pound', 'elephant.swipe'].includes(a.move) ? Math.hypot(dx, dz) < a.area.radius + 1 : cross < a.area.radius + (id === 'elephant' ? 2.5 : 1.2) && along > -2;
    });
    if (dangerous) {
      const a = dangerous.infected!.specialAttack!, dx = p.transform.x - a.area.x, dz = p.transform.z - a.area.z;
      if (['gorilla.roar', 'gorilla.pound', 'elephant.swipe'].includes(a.move)) { const d = Math.hypot(dx, dz) || 1; f.move = { x: dx / d, z: dz / d }; }
      else {
        const sign = dx * -a.area.dz + dz * a.area.dx >= 0 ? 1 : -1, first = { x: -a.area.dz * sign, z: a.area.dx * sign }, other = { x: -first.x, z: -first.z };
        const room = id === 'elephant' ? 6 : 3;
        f.move = w.solids.sweep(p, first, room) >= w.solids.sweep(p, other, room) ? first : other;
      }
    } else if (Math.hypot(p.transform.x - def.centre.x, p.transform.z - def.centre.z) > def.radius - 5) {
      f.move = this.walker.step(w, def.centre, def.radius - 6, `arena-${id}-inside`) ?? f.move;
    } else if (target) {
      const dx = target.transform.x - p.transform.x, dz = target.transform.z - p.transform.z, d = Math.hypot(dx, dz) || 1;
      if (d > 12 || d < 5) f.move = { x: dx / d * (d > 12 ? 1 : -1), z: dz / d * (d > 12 ? 1 : -1) };
    } else {
      const hidden = enemies.sort((a, b) => Math.hypot(a!.transform.x - p.transform.x, a!.transform.z - p.transform.z) - Math.hypot(b!.transform.x - p.transform.x, b!.transform.z - p.transform.z))[0];
      f.move = this.walker.step(w, hidden?.transform ?? def.centre, hidden ? 2 : 6, `arena-${id}-find-${hidden?.id ?? 0}`) ?? f.move;
    }
    return f;
  }
}
