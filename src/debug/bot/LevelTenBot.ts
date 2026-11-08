import { emptyInput, type InputFrame } from '../../input/InputFrame';
import { cornBlocksSight } from '../../levels/L10/farm';
import { cure } from '../../levels/L10/district';
import type { SimWorld } from '../../sim/world/SimWorld';
import { Walker } from './Walker';
import { solidLargeCorpse } from '../../sim/world/SolidRegistry';
import { isMega } from '../../data/megaPresentation';
import { finale as arena } from '../../data/l10Finale';
import { cureEscapeGaps } from '../../data/l10Story';

/** The existing L10 sim policy, available to browser diagnostics through bot.start. */
export class LevelTenBot {
  private readonly walker = new Walker();
  // Ordinary exploration inputs: visit the six placed finds and the escape gaps,
  // taking the field crossings instead of every ninety-degree road bend.
  private readonly route = [
    ...cure.regions[0].route.slice(0, 4), cure.anchors['farmhouse-rifle'], [cureEscapeGaps[0].x, cureEscapeGaps[0].z],
    cure.anchors['barn-machete'], cure.anchors['shed-molotov'], cure.anchors['workshop-nailgun'], cure.anchors['cure-military'],
    cure.anchors['guard-tower-rifle'], cure.anchors['checkpoint-flashbang'], [cureEscapeGaps[1].x, cureEscapeGaps[1].z], cure.anchors['r4-r5-seam'],
    cure.anchors['cure-research-entry'], cure.anchors['cure-terminal'], cure.anchors['cure-canister'], cure.anchors['cure-research'], cure.anchors['cure-corridor'],
    [cureEscapeGaps[2].x, cureEscapeGaps[2].z], cure.anchors['cure-complex'], ...cure.regions[6].route.slice(5),
  ];
  private waypoint = 0;
  private releaseAttempt = 0;
  private clearStairsUntil = 0;
  private coolingGun = false;
  private releaseSidestepUntil = 0;
  private releaseBlockedAt = 0;
  private readonly startTick: number;
  finished = false;
  constructor(private readonly w: SimWorld, readonly profile = 'complete') { this.startTick = w.tick; }
  sample(): InputFrame {
    const w = this.w, mission = w.missions!, player = w.entities.get(1)!, f = emptyInput();
    this.finished = mission.state.phase === 'result' || mission.state.phase === 'progression';
    const active = mission.def.steps.find(s => mission.state.steps[s.id].status === 'active');
    if (this.finished || this.profile === 'idle' || !active || player.health.current <= 0 || mission.state.phase === 'retry') return f;
    const tick = w.tick - this.startTick, p = player.transform;
    if (['install', 'hold', 'mega', 'release', 'epilogue', 'credits'].includes(active.id)) this.waypoint = this.route.length;
    const finale = active.id === 'hold' || active.id === 'mega';
    const anchor = mission.def.anchors[active.id === 'mega' ? 'cure-console' : active.anchor];
    const distance = (a: { x: number; z: number }) => Math.hypot(a.x - p.x, a.z - p.z);
    if (this.profile === 'threat-passive' && finale) {
      // Activate the native console with E before standing through the assault.
      if (mission.state.states['charge-active']) return f;
      const console = mission.def.anchors['cure-console'];
      f.move = this.walker.step(w, console, .8, 'activate-assault') ?? f.move;
      f.interact = distance(console) <= console.radius;
      return f;
    }
    const released = !!mission.state.states['cure-released'];
    while (this.waypoint < this.route.length && distance({ x: this.route[this.waypoint][0], z: this.route[this.waypoint][1] }) < 2) this.waypoint++;
    let goal = anchor;
    // Once the boss reaches the apron, follow its private pursuit anchor
    // around console cover. Waiting at the console cannot acquire a boss on
    // its far side; distant pursuit still stays anchored to the arena.
    const bossMarker = mission.def.anchors['cure-mega'];
    if (active.id === 'mega' && bossMarker && Math.hypot(bossMarker.x - anchor.x, bossMarker.z - anchor.z) <= arena.holdRadius) goal = bossMarker;
    if (!released && !finale && this.waypoint < this.route.length && this.route[this.waypoint][0] < anchor.x - 2) goal = { x: this.route[this.waypoint][0], z: this.route[this.waypoint][1], radius: 2 };
    if (released) goal = { x: anchor.x + (tick % 600 < 300 ? 12 : -12), z: anchor.z, radius: 1 };
    f.move = this.walker.step(w, goal, .8, `${active.id}-${this.waypoint}`) ?? f.move;
    // The static grid cannot see the Mega's solid corpse. If the tank and
    // corpse block the return route, try ordinary directional sidesteps as
    // the physical-input driver does, then resume walking to the console.
    if (active.id === 'release') {
      const blocker = w.solids.blockingBody(1);
      if (blocker && solidLargeCorpse(blocker) && (player.motion?.speed ?? 0) < .12) {
        this.releaseBlockedAt ||= w.tick;
        if (w.tick >= this.releaseSidestepUntil && w.tick - this.releaseBlockedAt >= 30) {
          this.releaseAttempt++;
          this.releaseSidestepUntil = w.tick + 90;
          this.walker.reset();
        }
      } else this.releaseBlockedAt = 0;
      if (w.tick < this.releaseSidestepUntil) {
        const angle = (this.releaseAttempt % 8) * Math.PI / 4;
        f.move = { x: Math.cos(angle), z: Math.sin(angle) };
      }
    }
    f.interact = !released && tick % 60 < 45 && distance(anchor) <= anchor.radius;
    // Bots share the documented camera + 5 m perception contract. A 30 m
    // omnidirectional scan shot unseen arrivals before they could enter view,
    // making the native route incomparable to real-input play.
    const threats = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.emerging && !e.infectionRise && distance(e.transform) < 30 && (isMega(e) || !cornBlocksSight(w, [p.x, p.z], [e.transform.x, e.transform.z])) && w.infected!.director.inPlayerView(e.transform, 30, 1, 5) && (p.y > 2 ? w.combat!.query.visible({ ...p, y: p.y + .45 }, e.transform) : w.infected!.nav.visible(p, e.transform, 0))).sort((a, b) => distance(a.transform) - distance(b.transform));
    const gun = w.mountedGun;
    if (active.id === 'hold' && mission.state.states['charge-active'] && gun && w.tick >= this.clearStairsUntil) {
      if (gun.mounted && threats.some(e => !isMega(e) && e.transform.y > arena.gun.deckHeight && distance(e.transform) < 6)) {
        this.clearStairsUntil = w.tick + 240; f.interact = true; return f;
      }
      if (gun.mounted) {
        f.move = { x: 0, z: 0 }; f.interact = false;
        const target = threats[0];
        if (target) {
          const dx = target.transform.x - p.x, dz = target.transform.z - p.z, d = Math.hypot(dx, dz) || 1;
          f.aim = { x: dx / d, z: dz / d }; f.aimSource = 'keyboard';
          if (gun.locked || gun.heat >= .92) this.coolingGun = true;
          if (gun.heat <= .35) this.coolingGun = false;
          f.right.held = !this.coolingGun;
        }
        return f;
      }
      const foot = { x: anchor.x + arena.platformStair.at[0], z: anchor.z + arena.platformStair.at[1] };
      const pivot = gun.placement;
      if (p.y < arena.gun.deckHeight + .2) {
        f.move = distance(foot) > 1 && p.x > foot.x - 1
          ? this.walker.step(w, foot, .5, 'gun-stair') ?? f.move : { x: -1, z: 0 };
      } else {
        const dx = pivot.x - p.x, dz = pivot.z - p.z, d = Math.hypot(dx, dz) || 1;
        f.move = { x: dx / d, z: dz / d };
      }
      f.interact = gun.canMount() && tick % 30 === 0;
    }
    if (active.id !== 'hold' && gun?.mounted) { f.interact = true; return f; }
    const rack = player.weapons!.RIGHT.rack, target = active.id === 'mega' ? threats.find(isMega) ?? threats[0] : threats[0];
    if (active.id === 'mega' && p.y > 2) f.move = this.walker.step(w, { x: anchor.x + arena.platformStair.at[0], z: anchor.z + arena.platformStair.at[1] }, .6, 'descend-stair') ?? f.move;

    // Moving targets need room for the rocket to arm before contact. Keep the
    // launcher for distant packs/Mega and the carried shotgun for close defence.
    const travelWeapon = ['weapon.army-mg', 'weapon.assault-rifle', 'weapon.nail-gun', 'weapon.hunting-rifle', 'weapon.machete', 'weapon.fire-axe'].find(id => rack.some(slot => slot.id === id));
    const targetDistance = target ? distance(target.transform) : 0;
    const rocket = target && isMega(target) && targetDistance >= 12 && w.combat!.query.clearDistance({ ...p, y: p.y + .45 },
      { x: (target.transform.x - p.x) / targetDistance, z: (target.transform.z - p.z) / targetDistance }, 10) >= 10;
    const wanted = !finale ? travelWeapon : rocket ? 'weapon.rocket-launcher' : targetDistance < 8 ? 'weapon.shotgun' : 'weapon.army-mg';
    const choice = rack.findIndex(slot => slot.id === wanted);
    const index = choice >= 0 ? choice : rack.length - 1, weapon = rack[index]?.id;
    if (!released && target && this.profile !== 'evade-only' && weapon && (weapon !== 'weapon.fire-axe' || distance(target.transform) < 2.5)) {
      f.selectedSlot = { side: 'RIGHT', index }; f.aimSource = 'keyboard';
      const dx = target.transform.x - p.x, dz = target.transform.z - p.z, d = Math.hypot(dx, dz) || 1;
      f.aim = { x: dx / d, z: dz / d }; f.aimPoint = { x: target.transform.x, z: target.transform.z }; f.right.held = true;
      if (finale && d < 10 && !gun?.mounted) {
        const angle = Math.atan2(p.z - anchor.z, p.x - anchor.x) + Math.PI / 4;
        f.move = this.walker.step(w, { x: anchor.x + Math.cos(angle) * 18, z: anchor.z + Math.sin(angle) * 18 }, 1, 'dodge') ?? f.move;
        if (d < 8) {
          const away = { x: p.x - dx / d * 3, z: p.z - dz / d * 3 };
          if (Math.hypot(away.x - anchor.x, away.z - anchor.z) < arena.holdRadius - 1 && w.infected!.nav.visible(p, away, .35)) f.move = { x: -dx / d, z: -dz / d };
        }
      }
    }
    if (this.profile === 'newbie') { f.move.x *= .8; f.move.z *= .8; }
    return f;
  }
}
