import { emptyInput, type InputFrame } from '../../input/InputFrame';
import { cornBlocksSight } from '../../levels/L10/farm';
import { cure } from '../../levels/L10/district';
import type { SimWorld } from '../../sim/world/SimWorld';
import { Walker } from './Walker';
import { isMega } from '../../data/megaPresentation';
import { finale as arena } from '../../data/l10Finale';
import { cureCorgiToy, cureEscapeGaps } from '../../data/l10Story';

/** The existing L10 sim policy, available to browser diagnostics through bot.start. */
export class LevelTenBot {
  private readonly walker = new Walker();
  // Ordinary exploration inputs: visit the six placed finds and the escape gaps,
  // taking the field crossings instead of every ninety-degree road bend.
  // PO 2026-11-19: the machete is the crash-site find on the river-exit leg, so
  // it is the first detour after the start; the barn stop is gone with the barn pickup.
  private readonly route = [
    ...cure.regions[0].route.slice(0, 1), cure.anchors['crash-machete'], ...cure.regions[0].route.slice(1, 4), cure.anchors['farmhouse-rifle'],
    [1042, 80], cure.anchors['shed-molotov'], cure.anchors['workshop-nailgun'], cure.anchors['cure-military'],
    cure.anchors['guard-tower-rifle'], cure.anchors['r4-r5-seam'],
    cure.anchors['cure-research-entry'], cure.anchors['cure-terminal'], cure.anchors['cure-canister'], cure.anchors['cure-research'], cure.anchors['cure-corridor'],
    // Approach the first roadblock along its open west lane. A direct diagonal
    // from the cure corridor clips the clinic annex at x≈3000,z≈65 and stalls
    // the long-wheelbase motorbike at its southwest corner.
    [2920, 95], [2980, 95], [3010, 95], [3076, 95], [3190, 95], [3260, 95], [cureEscapeGaps[2].x, cureEscapeGaps[2].z],
    [3370, 95], [3374, 95], [3370, 74], [3382, 74], [3406, 74], [3406, 95],
    [3502, 95], [3577, -25], cure.anchors['cure-complex'], ...cure.regions[6].route.slice(5),
  ];
  private waypoint = 0;
  private clearStairsUntil = 0;
  private coolingGun = false;
  private lastPosition?: { x: number; z: number };
  private readonly startTick: number;
  finished = false;
  constructor(private readonly w: SimWorld, readonly profile = 'complete') {
    this.startTick = w.tick;
    if (profile === 'optional-toy') this.route.splice(this.route.indexOf(cure.anchors['shed-molotov']), 0, [cureCorgiToy.x, cureCorgiToy.z]);
  }
  sample(): InputFrame {
    const w = this.w, mission = w.missions!, player = w.entities.get(1)!, f = emptyInput();
    this.finished = mission.state.phase === 'result' || mission.state.phase === 'progression';
    const active = mission.def.steps.find(s => mission.state.steps[s.id].status === 'active');
    if (this.finished || this.profile === 'idle' || !active || player.health.current <= 0 || mission.state.phase === 'retry') return f;
    const tick = w.tick - this.startTick, p = player.transform;
    // The quarantine checkpoint can restore the bike west of the billboard
    // after a later roadblock death. Rejoin the marked road there rather than
    // steering directly at a stale waypoint past the intervening obstacles.
    if (this.lastPosition && this.lastPosition.x > 3300 && p.x >= 3000 && p.x < 3150 && p.x < this.lastPosition.x - 100) {
      let nearest = this.waypoint, best = Infinity;
      for (let i = 0; i < this.route.length; i++) {
        if (this.route[i][0] < 2980 || this.route[i][0] > 3260) continue;
        const d = Math.hypot(this.route[i][0] - p.x, this.route[i][1] - p.z);
        if (d < best) { best = d; nearest = i; }
      }
      this.waypoint = nearest;
    }
    this.lastPosition = { x: p.x, z: p.z };
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
    while (this.waypoint < this.route.length) {
      const point = this.route[this.waypoint], toy = point[0] === cureCorgiToy.x && point[1] === cureCorgiToy.z;
      if (distance({ x: point[0], z: point[1] }) >= (toy ? 1.2 : 2)) break;
      this.waypoint++;
    }
    let goal = anchor;
    // Once the boss reaches the apron, follow its private pursuit anchor
    // around console cover. Waiting at the console cannot acquire a boss on
    // its far side; distant pursuit still stays anchored to the arena.
    const bossMarker = mission.def.anchors['cure-mega'];
    if (active.id === 'mega' && bossMarker && Math.hypot(bossMarker.x - anchor.x, bossMarker.z - anchor.z) <= arena.holdRadius) goal = bossMarker;
    if (!released && !finale && this.waypoint < this.route.length && this.route[this.waypoint][0] < anchor.x - 2) goal = { x: this.route[this.waypoint][0], z: this.route[this.waypoint][1], radius: 2 };
    if (released) goal = { x: anchor.x + (tick % 600 < 300 ? 12 : -12), z: anchor.z, radius: 1 };
    f.move = this.walker.step(w, goal, .8, `${active.id}-${this.waypoint}`, active.id === 'release') ?? f.move;
    f.interact = !released && tick % 60 < 45 && distance(anchor) <= anchor.radius;
    // Bots share the documented camera + 5 m perception contract. A 30 m
    // omnidirectional scan shot unseen arrivals before they could enter view,
    // making the native route incomparable to real-input play.
    const threats = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.emerging && !e.infectionRise && distance(e.transform) < 30 && (isMega(e) || !cornBlocksSight(w, [p.x, p.z], [e.transform.x, e.transform.z])) && w.infected!.director.inPlayerView(e.transform, 30, 1, 5) && (p.y > 2 ? w.combat!.query.visible({ ...p, y: p.y + .45 }, e.transform) : w.infected!.nav.visible(p, e.transform, 0))).sort((a, b) => distance(a.transform) - distance(b.transform));
    const bike = w.vehicles?.bicycle, bikeEntity = bike?.entity;
    let roadblockFight = false;
    if (bike && bikeEntity?.bicycle?.motorbike && p.x >= 2780 && p.x < 3750 && !finale) {
      const gates = Object.entries(w.l10Encounters?.state.roadblockGates ?? {})
        .map(([group, id]) => ({ group, entity: w.entities.get(id) })).filter(g => !!g.entity?.interactable)
        .sort((a, b) => Math.abs(a.entity!.transform.x - p.x) - Math.abs(b.entity!.transform.x - p.x));
      const closedGate = gates.find(g => !g.entity!.interactable!.open && Math.abs(p.x - g.entity!.transform.x) < 24);
      roadblockFight = !!closedGate;
      // Each physical roadblock is a mounted approach followed by an on-foot
      // fight. E dismounts the rider; the device stays disabled until its
      // admitted cohort is cleared, so this press cannot toggle the barrier.
      if (bike.riding && closedGate) { f.interact = true; return f; }
      const fightingThisGate = !!closedGate && !!w.l10Encounters?.state.roadblockDismounted?.[closedGate.group];
      if (!bike.riding && closedGate && fightingThisGate) {
        const side = Math.floor(tick / 180) % 2 ? -10 : 10;
        const approach = { x: closedGate.entity!.transform.x - 6, z: closedGate.entity!.transform.z + side, radius: 1.5 };
        f.move = this.walker.step(w, approach, .8, 'roadblock-fight') ?? f.move;
      }
      else if (!bike.riding && closedGate) {
        // If a prior knock-off happened between set pieces, recover the bike
        // before entering the next roadblock. Each barrier must start mounted.
        f.move = this.walker.step(w, bikeEntity.transform, this.profile === 'threat-passive' ? .5 : 1, 'motorbike', this.profile === 'threat-passive') ?? f.move;
        f.interact = bike.canInteract() && tick % 30 === 0;
      }
      // Recover the same parked bike after a hard hit or a cleared roadblock.
      // Keep aiming and firing while walking back so the rider can create
      // space, then remount with the normal E interaction.
      else if (!closedGate && !bike.riding) {
        f.move = this.walker.step(w, bikeEntity.transform, this.profile === 'threat-passive' ? .5 : 1, 'motorbike', this.profile === 'threat-passive') ?? f.move;
        f.interact = bike.canInteract() && tick % 30 === 0;
      }
    }
    // A visible dog pounce has a short, committed windup. Face and hit that
    // dog while the ground telegraph is live instead of continuing to shoot
    // whichever ordinary infected happens to be a fraction closer.
    const pouncingDog = threats.find(e => e.archetype === 'infected.dog' && e.infected?.state === 'attack' && e.infected.until > w.tick);
    const gun = w.mountedGun;
    const approachGun = active.id === 'hold' && mission.state.states['charge-active'] && gun && w.tick >= this.clearStairsUntil;
    if (approachGun) {
      if (gun.mounted && threats.some(e => e.transform.y > arena.gun.deckHeight && distance(e.transform) < 6)) {
        this.clearStairsUntil = w.tick + 240; f.interact = true; return f;
      }
      if (gun.mounted) {
        f.move = { x: 0, z: 0 }; f.interact = false;
        const target = pouncingDog ?? threats[0];
        if (target) {
          const dx = target.transform.x - p.x, dz = target.transform.z - p.z, d = Math.hypot(dx, dz) || 1;
          f.aim = { x: dx / d, z: dz / d }; f.aimSource = 'keyboard';
          if (gun.locked || gun.heat >= .92) this.coolingGun = true;
          if (gun.heat <= .35) this.coolingGun = false;
          f.right.held = !this.coolingGun;
        }
        return f;
      }
      const [footX, footZ] = cure.anchors['dispersal-stair-foot'];
      const foot = { x: footX, z: footZ };
      const pivot = gun.placement;
      if (p.y < arena.gun.deckHeight + .2) {
        // Walk onto the ramp after reaching its foot. Stopping here leaves
        // the courier below the gun; walking east while already raised sends
        // it back down the ramp before it can reach the deck.
        f.move = p.y > .9 || distance(foot) < .45
          ? { x: -1, z: Math.max(-1, Math.min(1, (foot.z - p.z) * 2)) }
          : this.walker.step(w, foot, .25, 'gun-stair') ?? f.move;
      } else {
        const dx = pivot.x - p.x, dz = pivot.z - p.z, d = Math.hypot(dx, dz) || 1;
        f.move = { x: dx / d, z: dz / d };
      }
      f.interact = gun.canMount() && tick % 30 === 0;
      if (f.interact) return f;
    }
    if (active.id !== 'hold' && gun?.mounted) { f.interact = true; return f; }
    // Clear an attacker in melee reach before focusing the finale Mega. An
    // uninterrupted boss target leaves the courier surrounded on the stairs.
    const closeAttacker = active.id === 'mega' ? threats.find(e => !isMega(e) && distance(e.transform) < 8) : undefined;
    const downedRoadblockThreat = roadblockFight ? w.infected!.active.find(e =>
      e.health.current <= 0 && (e.infected?.recoverAt ?? -1) >= 0 && distance(e.transform) < 8 &&
      w.infected!.director.inPlayerView(e.transform, 30, 1, 5) && w.infected!.nav.visible(p, e.transform, 0)) : undefined;
    const rack = player.weapons!.RIGHT.rack, target = pouncingDog ?? closeAttacker ??
      (roadblockFight ? threats.find(e => !isMega(e)) ?? downedRoadblockThreat : undefined) ??
      (active.id === 'mega' ? threats.find(isMega) ?? threats[0] : threats[0]);
    if (['mega', 'release'].includes(active.id) && p.y > .9) {
      // Interaction console is 2 m east of the assembly origin. Use the
      // shipped stair anchors, rather than translating them from that marker.
      const [topX, topZ] = cure.anchors['dispersal-stair-top'], [footX, footZ] = cure.anchors['dispersal-stair-foot'];
      const top = { x: topX, z: topZ }, foot = { x: footX, z: footZ };
      // Once on the ramp, continue to its foot even after a lateral shove.
      // Asking the ground/deck grid for the top from mid-ramp can return a
      // zero move forever because neither grid owns that sloped support.
      if (p.x < top.x - .25 || p.y >= arena.gun.deckHeight + .2 && Math.abs(p.z - top.z) > .25) f.move = this.walker.step(w, top, .2, 'descend-landing', true) ?? { x: 0, z: 0 };
      else {
        const dx = foot.x - p.x, dz = foot.z - p.z, d = Math.hypot(dx, dz) || 1;
        f.move = { x: dx / d, z: dz / d };
      }
    }

    // Moving targets need room for the rocket to arm before contact. Keep the
    // launcher for distant packs/Mega and the carried shotgun for close defence.
    // Prefer the long-range rifle to the quiet pinning tool while crossing open ground.
    const travelWeapon = ['weapon.army-mg', 'weapon.assault-rifle', 'weapon.hunting-rifle', 'weapon.nail-gun', 'weapon.machete', 'weapon.fire-axe'].find(id => rack.some(slot => slot.id === id));
    const targetDistance = target ? distance(target.transform) : 0;
    const rocket = target && isMega(target) && targetDistance >= 18 && w.combat!.query.clearDistance({ ...p, y: p.y + .45 },
      { x: (target.transform.x - p.x) / targetDistance, z: (target.transform.z - p.z) / targetDistance }, targetDistance) >= targetDistance;
    const wanted = bike?.riding && bikeEntity?.bicycle?.motorbike ? 'weapon.handgun'
      : pouncingDog && distance(pouncingDog.transform) < 12 && rack.some(slot => slot.id === 'weapon.shotgun') ? 'weapon.shotgun'
      : roadblockFight && target && !isMega(target) && targetDistance < 8 && rack.some(slot => slot.id === 'weapon.flamethrower') ? 'weapon.flamethrower'
      : !finale ? travelWeapon : rocket ? 'weapon.rocket-launcher' : targetDistance < 8 ? 'weapon.shotgun' : 'weapon.army-mg';
    const handgunSide = bike?.riding && bikeEntity?.bicycle?.motorbike
      ? (['LEFT', 'RIGHT'] as const).find(side => player.weapons![side].rack[player.weapons![side].index]?.id === 'weapon.handgun') : undefined;
    const side = handgunSide ?? 'RIGHT', selectedRack = player.weapons![side].rack;
    const choice = selectedRack.findIndex(slot => slot.id === wanted);
    const index = choice >= 0 ? choice : selectedRack.length - 1, weapon = selectedRack[index]?.id;
    if (!released && target && this.profile !== 'evade-only' && weapon && (weapon !== 'weapon.fire-axe' || distance(target.transform) < 2.5)) {
      f.selectedSlot = { side, index }; f.aimSource = 'keyboard';
      const dx = target.transform.x - p.x, dz = target.transform.z - p.z, d = Math.hypot(dx, dz) || 1;
      f.aim = { x: dx / d, z: dz / d }; f.aimPoint = { x: target.transform.x, z: target.transform.z }; (side === 'LEFT' ? f.left : f.right).held = true;
      if (finale && d < 10 && p.y <= .9 && !gun?.mounted && !approachGun) {
        const angle = Math.atan2(p.z - anchor.z, p.x - anchor.x) + Math.PI / 4;
        f.move = this.walker.step(w, { x: anchor.x + Math.cos(angle) * 18, z: anchor.z + Math.sin(angle) * 18 }, 1, 'dodge') ?? f.move;
        if (d < 8) {
          const away = { x: p.x - dx / d * 3, z: p.z - dz / d * 3 };
          if (Math.hypot(away.x - anchor.x, away.z - anchor.z) < arena.holdRadius - 1 && w.infected!.nav.visible(p, away, .35)) f.move = { x: -dx / d, z: -dz / d };
        }
      }
    }
    // Walk out of visible ground fire while fighting or returning to the bike.
    if (!bike?.riding && p.x >= 2780 && p.x < 3750 && !finale) {
      const fires = [...w.entities.iterate()].filter(e => e.hazard?.kind === 'fire' && w.tick < e.hazard.activeUntil &&
        distance(e.transform) < e.hazard.radius + 1.5);
      let dx = 0, dz = 0;
      for (const fire of fires) {
        const x = p.x - fire.transform.x, z = p.z - fire.transform.z, d = Math.hypot(x, z) || 1;
        dx += x / d; dz += z / d;
      }
      const d = Math.hypot(dx, dz);
      if (d > 0 && w.infected!.nav.visible(p, { x: p.x + dx / d * 2, z: p.z + dz / d * 2 }, .35))
        f.move = { x: dx / d, z: dz / d };
    }
    if (this.profile === 'newbie') { f.move.x *= .8; f.move.z *= .8; }
    return f;
  }
}
