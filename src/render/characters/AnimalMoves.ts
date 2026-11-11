import type { EntitySnapshot } from '../../sim/world/types';

/**
 * r32-animalmoves: the L8 animal signature moves as presentation only (never read by the sim). Each species gets its
 * own body language for its telegraph and its strike, layered on the baked animal atlas by CrowdLocomotion:
 * - lion / lioness: low stalk with a shoulder roll, crouch + butt wiggle before the pounce, a leap with forelegs
 *   reaching and hind legs stretched, a rear-up pin with a biting jaw, a head-up roar;
 * - flamingo: real flight (cruise height with wing beats), a climb on the telegraph and a swoop down the dive lane
 *   and back up; dead birds fall;
 * - gorilla: chest-beat (existing layer), both arms high before the pound and a full-body slam;
 * - elephant: trunk up (trumpet) and a front-leg stamp before the charge, head down while charging;
 * - monkey: a leap arc for the grab and a visible cling on the courier with a shaking body.
 * Angles in radians in the hip parent's space (+x forward, +y up, +z lateral); +pitch = nose up, +front/+hind = leg
 * swung forward.
 */
export interface AnimalPose {
  /** Pelvis drop (m); planted paws bend the legs. */
  crouch: number;
  pitch: number; roll: number; head: number; jaw: number;
  front: number; hind: number;
  /** Gorilla: both arms raised over the head (0..1). */
  armsUp: number;
  /** Elephant: left foreleg lifted for a stamp (0..1). */
  stamp: number;
  /** Elephant trunk raised (rad). */
  trunk: number;
  /** Flamingo: wings spread (0..1) and beat angle (rad). */
  wing: number; flap: number;
  /** Paws leave the ground: skip paw planting and sole grounding for this frame. */
  airborne: boolean;
}
const ease = (u: number): number => { const t = Math.max(0, Math.min(1, u)); return t * t * (3 - 2 * t); };
const clamp01 = (u: number): number => Math.max(0, Math.min(1, u));
export type AnimalSpecies = 'dog' | 'lion' | 'flamingo' | 'gorilla' | 'elephant' | 'monkey' | 'zebra';
export function animalSpecies(e: EntitySnapshot): AnimalSpecies | undefined {
  const id = e.civilian?.zooAnimal ?? e.archetype?.replace(/^infected\./, '');
  return id === 'dog' || id === 'lion' || id === 'lioness' ? id === 'lioness' ? 'lion' : id : id === 'flamingo' || id === 'gorilla' || id === 'elephant' || id === 'monkey' || id === 'zebra' ? id : undefined;
}
/** Flamingo cruise height over the ground while the flock is engaged (m). */
export const flamingoCruise = 2.4;

export class AnimalMoves {
  private readonly pose: AnimalPose = { crouch: 0, pitch: 0, roll: 0, head: 0, jaw: 0, front: 0, hind: 0, armsUp: 0, stamp: 0, trunk: 0, wing: 0, flap: 0, airborne: false };
  /** Smoothed render height per flying/leaping animal (m above its sim position). */
  private readonly heights = new Map<number, { y: number; tick: number }>();
  private readonly dogStrikes = new Map<number, number>();
  /** Embedded dog bite phase, including render-only recovery; -1 outside an attack. */
  dogPhase = -1;
  /** Render-only height above the sim transform for this frame (flight, monkey leap/cling). */
  lift = 0;
  /** Phase override for the flight loop (0..1), or -1. */
  flightPhase = -1;

  /** Pose for one animal, or undefined when nothing species-specific applies this frame. */
  sample(e: EntitySnapshot, renderTick: number, speed: number, gaitPhase: number): AnimalPose | undefined {
    this.lift = 0; this.flightPhase = -1;
    this.dogPhase = -1;
    const species = animalSpecies(e);
    if (!species || species === 'zebra') return undefined;
    const p = this.pose;
    p.crouch = p.pitch = p.roll = p.head = p.jaw = p.front = p.hind = p.armsUp = p.stamp = p.trunk = p.wing = p.flap = 0; p.airborne = false;
    const b = e.infected, a = b?.specialAttack, dead = !b ? e.health.current <= 0 : b.state === 'dead' || e.health.current <= 0;
    const t = renderTick / 60 + e.id * .37;
    const windup = a ? ease((renderTick - a.startTick) / Math.max(1, a.activeTick - a.startTick)) : 0;
    const travel = a?.destination ? clamp01(Math.hypot(e.transform.x - a.area.x, e.transform.z - a.area.z) / Math.max(.5, Math.hypot(a.destination.x - a.area.x, a.destination.z - a.area.z))) : 0;
    const grabbing = !!b && b.grabUntil > renderTick && !dead;
    if (species === 'dog') {
      if (!b || dead) { this.dogStrikes.delete(e.id); return undefined; }
      if (b.state === 'attack') this.dogStrikes.set(e.id, b.until);
      const strikeAt = this.dogStrikes.get(e.id);
      let phase: number | undefined;
      if (b.state === 'attack' && strikeAt !== undefined) phase = .5 * clamp01(1 - (strikeAt - renderTick) / 39);
      else if (strikeAt !== undefined && renderTick >= strikeAt - 1 && renderTick - strikeAt < 27) phase = .5 + .5 * Math.max(0, renderTick - strikeAt) / 27;
      else if (strikeAt !== undefined) this.dogStrikes.delete(e.id);
      if (phase !== undefined) {
        this.dogPhase = phase < .5 ? phase * .8 : .4 + (phase - .5) * 1.2;
        const strike = phase >= .5 ? 1 - clamp01((phase - .68) / .32) : 0;
        // The embedded clip owns the four legs and body. A second limb pose
        // on its recovery lifted the forequarters and dragged the rear paws.
        p.head = -.05 * strike;
        p.jaw = .75 * strike; p.airborne = phase > .56 && phase < .86;
        // Give the authored spring a world-space arc; its in-place paw sweep
        // otherwise crosses the floor while the contact solver is released.
        this.lift = .12 * Math.sin(Math.PI * clamp01((phase - .5) / .4));
        return p;
      }
      if (speed > .06) { p.pitch = Math.sin(gaitPhase * Math.PI * 2) * .08; p.head = -.06; }
      return speed > .06 ? p : undefined;
    }
    if (species === 'lion') {
      if (dead || !b) return speed > .06 && speed < 2.6 ? this.stalk(p, gaitPhase, .4) : undefined;
      if (a && (a.move === 'lion.pounce' || a.move === 'lion.flank')) {
        if (a.stage === 'telegraph') {
          // Crouch low, head down and forward, a short butt wiggle in the last half.
          p.crouch = .26 * windup; p.pitch = -.1 * windup; p.head = -.28 * windup; p.hind = .25 * windup; p.front = -.12 * windup;
          p.roll = windup > .5 ? Math.sin(t * 34) * .07 * (windup - .5) * 2 : 0;
        } else if (a.stage === 'active') {
          // Leap: nose up on take-off, down to the landing; forelegs reach, hind legs stretch out behind.
          const f = travel; p.airborne = true;
          p.pitch = .38 * Math.cos(Math.PI * f); p.front = .95; p.hind = -.75 * (1 - f * .5); p.head = -.1; p.jaw = .6;
        } else {
          const r = clamp01((renderTick - (a.recoveryUntil - 120)) / 30);
          p.crouch = .14 * (1 - r); p.pitch = -.12 * (1 - r); p.head = -.1 * (1 - r);
        }
        return p;
      }
      if (a?.move === 'lion.roar') {
        const k = a.stage === 'telegraph' ? windup : a.stage === 'recovery' ? 1 - clamp01((renderTick - (a.recoveryUntil - 120)) / 60) : 1;
        p.head = .42 * k; p.jaw = .9 * k; p.pitch = .12 * k; p.crouch = .05 * k; p.front = -.1 * k;
        return p;
      }
      if (grabbing) {
        // Pin: reared onto the courier, forelegs on her, jaw snapping.
        p.pitch = .32; p.front = .75; p.head = -.25 + Math.sin(t * 9) * .08; p.jaw = .35 + .35 * Math.sin(t * 9);
        return p;
      }
      // Stalk: low, slow, rolling shoulders, head level and low; a bounding run pitches the spine with the stride.
      if (speed > 5) { p.pitch = Math.sin(gaitPhase * Math.PI * 2) * .1; p.head = -.08; return p; }
      if (speed > .06) return this.stalk(p, gaitPhase, b.arenaBoss?.hunt ? 1 : .6);
      return undefined;
    }
    if (species === 'flamingo') {
      const engaged = !!b && !dead && (!!b.arenaBoss?.engaged || b.state === 'chase' || b.state === 'attack' || !!a);
      let target = 0;
      if (engaged) {
        target = flamingoCruise + Math.sin(t * 1.3) * .25;
        if (a?.move === 'flamingo.dive') {
          if (a.stage === 'telegraph') target = flamingoCruise + .9 * windup;
          else if (a.stage === 'active') target = (flamingoCruise + .9) - (flamingoCruise + .5) * Math.sin(Math.PI * Math.min(1, travel * 1.05));
        }
      }
      const h = this.heights.get(e.id) ?? { y: 0, tick: renderTick };
      const dt = Math.max(0, Math.min(.1, (renderTick - h.tick) / 60));
      // Dive: follow the authored arc exactly; everything else eases (take-off, landing, a falling corpse).
      h.y = a?.move === 'flamingo.dive' && a.stage === 'active' ? target : h.y + (target - h.y) * (1 - Math.exp(-dt * (dead ? 6 : 2.2)));
      h.tick = renderTick; this.heights.set(e.id, h);
      this.lift = h.y;
      if (h.y > .15) {
        p.airborne = true; p.wing = 1; p.hind = -1.25 * clamp01(h.y / .8);
        const diving = a?.move === 'flamingo.dive' && a.stage === 'active';
        if (diving) {
          // Swoop: wings swept, nose down into the lane and up out of it.
          p.pitch = -.55 * Math.cos(Math.PI * travel); p.wing = .45; p.flap = .25; p.head = -.2;
        } else {
          const beat = a?.stage === 'telegraph' ? 4.6 : 3;
          this.flightPhase = (t * beat) % 1; p.flap = Math.sin(this.flightPhase * Math.PI * 2) * .75; p.pitch = .08;
        }
      }
      return p.airborne ? p : undefined;
    }
    if (species === 'gorilla') {
      if (!b || dead) return undefined;
      if (a?.move === 'gorilla.pound') {
        if (a.stage === 'telegraph') { p.armsUp = windup; p.pitch = .3 * windup; p.head = .15 * windup; }
        else { const r = clamp01((renderTick - a.activeTick) / 40); const slam = r < .15 ? r / .15 : 1 - ease((r - .15) / .85); p.armsUp = -.35 * slam; p.pitch = -.35 * slam; p.crouch = .18 * slam; p.head = -.2 * slam; }
        return p;
      }
      return undefined;
    }
    if (species === 'elephant') {
      if (!b || dead) return undefined;
      if (a?.move === 'elephant.charge') {
        if (a.stage === 'telegraph') {
          // Trumpet (trunk and head up) and two heavy stamps of the left foreleg.
          const s = Math.sin(clamp01((renderTick - a.startTick) / Math.max(1, a.activeTick - a.startTick)) * Math.PI * 4);
          p.trunk = 1.1 * ease(windup * 2); p.head = .22 * ease(windup * 2); p.jaw = .5 * ease(windup * 2); p.stamp = Math.max(0, s); p.pitch = .05 * Math.max(0, s);
        } else if (a.stage === 'active') { p.head = -.16; p.trunk = -.25; p.pitch = -.04; }
        return p;
      }
      return undefined;
    }
    // monkey
    if (!b || dead) return undefined;
    if (a?.move === 'monkey.grab' && a.stage === 'active') {
      this.lift = Math.sin(Math.PI * travel) * 1.1; p.airborne = this.lift > .05; p.front = 1.1; p.hind = -.6; p.pitch = .25 * Math.cos(Math.PI * travel);
      return p;
    }
    if (grabbing) {
      // Cling: up on the courier's side, limbs wrapped, body shaking as it pulls.
      this.lift = .75; p.airborne = true; p.front = 1.3; p.hind = .9; p.pitch = .55; p.roll = Math.sin(t * 22) * .16; p.head = Math.sin(t * 11) * .2; p.jaw = .5 + .4 * Math.sin(t * 15);
      return p;
    }
    if (a?.move === 'monkey.grab' && a.stage === 'telegraph') { p.crouch = .1 * windup; p.pitch = -.15 * windup; p.hind = .3 * windup; return p; }
    return undefined;
  }
  private stalk(p: AnimalPose, phase: number, weight: number): AnimalPose {
    const s = Math.sin(phase * Math.PI * 2);
    p.crouch = .11 * weight; p.head = -.16 * weight; p.pitch = -.03 * weight; p.roll = s * .07 * weight;
    return p;
  }
  /** Forget per-figure state for entities no longer drawn. */
  prune(renderTick: number): void { for (const [id, h] of this.heights) if (renderTick - h.tick > 120 || renderTick < h.tick) this.heights.delete(id); }
}
