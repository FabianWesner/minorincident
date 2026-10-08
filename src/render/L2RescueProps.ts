import { BoxGeometry, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshBasicNodeMaterial, Quaternion, Vector3 } from 'three/webgpu';
import { l2 } from '../data/l2';
import type { SimWorld } from '../sim/world/SimWorld';

/** Front doors (east face, sliding along z) and loading door (south face, sliding along x) of Grove Market. */
const DOORS = [
  { axis: 'z' as const, face: -51.32, centre: -42.2, from: -46.6, to: -37.8 },
  { axis: 'x' as const, face: -37.66, centre: -55.6, from: -59.7, to: -51.4 },
];
const HALF = 2, HEIGHT = 2.55, CHAIN_Y = 1.05;
const SPARKS = 9, PUFFS = 22;
const hash = (n: number): number => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

/**
 * E20 rescue set piece code art (PO 10-08 "there is no emergency"), driven by the L2 sim state: Grove Market's glass fronts
 * with chained sliding doors (the people behind them stay visible), the chain jerking and spitting sparks while the crew
 * heaves on their halligan bars, the leaves sliding open and the chain dropping at `l2.doorsOpen`, and a smoke column rising
 * from a side street behind the market from the ride on. Instanced boxes and puffs, unlit colours (read at midday).
 */
export class L2RescueProps extends Group {
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly puff = new IcosahedronGeometry(1, 0);
  private readonly glassMat = new MeshBasicNodeMaterial({ color: '#bfe4ef', transparent: true, opacity: .2, depthWrite: false });
  private readonly frameMat = new MeshBasicNodeMaterial({ color: '#2c3036' });
  private readonly chainMat = new MeshBasicNodeMaterial({ color: '#8d9399' });
  private readonly lockMat = new MeshBasicNodeMaterial({ color: '#c9a338' });
  private readonly sparkMat = new MeshBasicNodeMaterial({ color: '#ffd77a' });
  private readonly barMat = new MeshBasicNodeMaterial({ color: '#4a4f57' });
  private readonly smokeDark = new MeshBasicNodeMaterial({ color: '#45464a' });
  private readonly smokeLight = new MeshBasicNodeMaterial({ color: '#6e6f73' });
  private readonly glass: InstancedMesh; private readonly frames: InstancedMesh; private readonly chains: InstancedMesh; private readonly locks: InstancedMesh;
  private readonly sparks: InstancedMesh; private readonly bars: InstancedMesh; private readonly smoke: InstancedMesh[];
  private readonly m4 = new Matrix4(); private readonly q = new Quaternion(); private readonly v = new Vector3(); private readonly sv = new Vector3();
  private readonly dir = new Vector3(); private readonly yUp = new Vector3(0, 1, 0); private readonly xAxis = new Vector3(1, 0, 0);
  constructor(private readonly world: SimWorld) {
    super(); this.name = 'l2-rescue-props';
    const mesh = (geometry: BoxGeometry | IcosahedronGeometry, material: MeshBasicNodeMaterial, count: number) => {
      const m = new InstancedMesh(geometry, material, count); m.count = 0; m.frustumCulled = false; this.add(m); return m;
    };
    this.glass = mesh(this.box, this.glassMat, 8); this.glass.renderOrder = 2;
    this.frames = mesh(this.box, this.frameMat, 40); this.chains = mesh(this.box, this.chainMat, 48); this.locks = mesh(this.box, this.lockMat, 2);
    this.sparks = mesh(this.box, this.sparkMat, SPARKS * 2 * 2); this.bars = mesh(this.box, this.barMat, 6);
    this.smoke = [mesh(this.puff, this.smokeDark, PUFFS), mesh(this.puff, this.smokeLight, PUFFS)];
    this.update();
  }
  /** Axis-aligned box on a door face: `u` along the face, `y` up, `n` outward offset from the face. */
  private faceBox(target: InstancedMesh, i: number, door: typeof DOORS[number], u: number, y: number, n: number, su: number, sy: number, sn: number): void {
    if (door.axis === 'z') { this.v.set(door.face + n, y, u); this.sv.set(sn, sy, su); }
    else { this.v.set(u, y, door.face + n); this.sv.set(su, sy, sn); }
    this.m4.compose(this.v, this.q.identity(), this.sv); target.setMatrixAt(i, this.m4);
  }
  /** A thin box from a to b (chain link, halligan bar). */
  private segment(target: InstancedMesh, i: number, a: Vector3, b: Vector3, thickness: number): void {
    this.dir.subVectors(b, a); const length = this.dir.length() || 1e-3;
    this.q.setFromUnitVectors(this.xAxis, this.dir.multiplyScalar(1 / length));
    this.m4.compose(this.v.addVectors(a, b).multiplyScalar(.5), this.q, this.sv.set(length, thickness, thickness)); target.setMatrixAt(i, this.m4);
  }
  update(): void {
    const s = this.world.missions?.state.l2, tick = this.world.tick;
    this.visible = !!s; if (!s) return;
    const open = s.doorsOpenAt > 0 ? Math.min(1, (tick - s.doorsOpenAt) / 30) : 0, slide = open * open * (3 - 2 * open);
    const forcing = s.phase === 'doors' && s.atDoorsAt > 0, t = (tick - s.atDoorsAt) / 60;
    let g = 0, f = 0, c = 0, sp = 0;
    for (const [d, door] of DOORS.entries()) {
      // Fixed panes either side of the opening, then the two sliding leaves (outside the fixed glass while they open).
      for (const [a, b] of [[door.from, door.centre - HALF], [door.centre + HALF, door.to]]) {
        this.faceBox(this.glass, g++, door, (a + b) / 2, HEIGHT / 2, 0, b - a, HEIGHT, .03);
        for (const u of [a, b]) this.faceBox(this.frames, f++, door, u, HEIGHT / 2, 0, .09, HEIGHT, .09);
      }
      for (const side of [-1, 1]) {
        const centre = door.centre + side * (HALF / 2 + slide * HALF * .95);
        this.faceBox(this.glass, g++, door, centre, HEIGHT / 2, .07, HALF - .04, HEIGHT - .05, .03);
        for (const edge of [-1, 1]) this.faceBox(this.frames, f++, door, centre + edge * (HALF / 2 - .04), HEIGHT / 2, .07, .07, HEIGHT - .05, .08);
        this.faceBox(this.frames, f++, door, centre, .06, .07, HALF - .04, .12, .08);
        // Push bar handles at the meeting edge.
        this.faceBox(this.frames, f++, door, centre - side * (HALF / 2 - .18), CHAIN_Y, .16, .05, .5, .05);
      }
      this.faceBox(this.frames, f++, door, (door.from + door.to) / 2, HEIGHT + .08, 0, door.to - door.from, .16, .14);
      // The chain: an X of links through both handles and a padlock; it jerks on each heave and lies on the ground once cut.
      const heave = forcing ? Math.max(0, Math.sin(t * Math.PI * 2 / .9 + d)) : 0, jerk = forcing ? Math.sin(tick * 1.7 + d * 3) * .03 * heave : 0;
      const at = (u: number, y: number, n: number) => door.axis === 'z' ? new Vector3(door.face + n, y, u) : new Vector3(u, y, door.face + n);
      if (!open) {
        for (const [y0, y1] of [[CHAIN_Y + .22, CHAIN_Y - .2], [CHAIN_Y - .2, CHAIN_Y + .22]]) {
          for (let k = 0; k < 8; k++) {
            const u0 = door.centre - .2 + k * .05, u1 = u0 + .05, sag = Math.sin(k / 7 * Math.PI) * .03;
            this.segment(this.chains, c++, at(u0 + jerk, y0 + (y1 - y0) * k / 8 - sag, .22 + heave * .05), at(u1 + jerk, y0 + (y1 - y0) * (k + 1) / 8 - sag, .22 + heave * .05), .035);
          }
        }
        this.v.copy(at(door.centre + jerk, CHAIN_Y - .14, .25 + heave * .05)); this.m4.compose(this.v, this.q.identity(), this.sv.set(.12, .15, .12)); this.locks.setMatrixAt(d, this.m4);
      } else {
        for (let k = 0; k < 8; k++) this.segment(this.chains, c++, at(door.centre - .4 + k * .1, .03, .5 + (k % 2) * .08), at(door.centre - .32 + k * .1, .03, .55 - (k % 2) * .06), .035);
        this.v.copy(at(door.centre + .3, .06, .6)); this.m4.compose(this.v, this.q.identity(), this.sv.set(.12, .1, .14)); this.locks.setMatrixAt(d, this.m4);
      }
      // Sparks at the chain on each heave: short ballistic bursts.
      if (forcing) for (let k = 0; k < SPARKS; k++) for (let burst = 0; burst < 2; burst++) {
        const period = 28, phase = tick + d * 11 + burst * 14, born = phase - (phase % period), age = (phase % period) / 60;
        if (age > .32) continue;
        const h = hash(born * 31 + k * 7 + d), out = .3 + h * 1.4, side = (hash(born + k * 13) - .5) * 2.2, upV = .6 + hash(k + born * 3) * 1.6;
        const p = at(door.centre + side * age, CHAIN_Y + upV * age - 4.9 * age * age, .25 + out * age);
        this.m4.compose(p, this.q.identity(), this.sv.setScalar(.045 * (1 - age * 2))); this.sparks.setMatrixAt(sp++, this.m4);
      }
    }
    // Halligan bars: from each heaving firefighter's hands to the chain at their door.
    let b = 0;
    if (forcing) for (const id of s.crewIds) {
      const e = this.world.entities.get(id); if (!e || e.hidden || e.civilian?.story?.clip !== 'ff-pry') continue;
      const door = e.transform.x > -52 ? DOORS[0] : DOORS[1], fx = Math.cos(e.transform.yaw), fz = -Math.sin(e.transform.yaw);
      const reach = .45 + .1 * Math.sin(((tick - e.civilian.story.start) / 60 / .9) * Math.PI * 2);
      const hands = new Vector3(e.transform.x + fx * reach, 1.02, e.transform.z + fz * reach);
      const chain = door.axis === 'z' ? new Vector3(door.face + .2, CHAIN_Y, door.centre + (e.transform.z - door.centre) * .25) : new Vector3(door.centre + (e.transform.x - door.centre) * .25, CHAIN_Y, door.face + .2);
      this.segment(this.bars, b++, hands, chain, .05);
    }
    // Smoke from a side street behind the market, from the ride on: two shades of rising, growing puffs.
    const smokeOn = s.departAt > 0 || s.arrivedAt > 0, [sx, sz] = l2.rescue.danger.smoke;
    for (const [m, mesh] of this.smoke.entries()) {
      let n = 0;
      if (smokeOn) for (let i = 0; i < PUFFS; i++) {
        const life = 7.5, age = ((tick / 60 + (i + m * .5) * life / PUFFS) % life) / life, h = hash(i * 17 + m * 5);
        const size = (.7 + age * 2.6) * (1 - Math.max(0, (age - .82) / .18)) * (.8 + h * .4);
        this.v.set(sx + age * 5 + Math.sin(age * 6 + i) * .5, 1 + age * 13, sz + age * 2.2 + Math.cos(age * 5 + i) * .5);
        this.m4.compose(this.v, this.q.setFromAxisAngle(this.yUp, i), this.sv.setScalar(Math.max(.01, size))); mesh.setMatrixAt(n++, this.m4);
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
    }
    this.glass.count = g; this.frames.count = f; this.chains.count = c; this.locks.count = 2; this.sparks.count = sp; this.bars.count = b;
    for (const m of [this.glass, this.frames, this.chains, this.locks, this.sparks, this.bars]) m.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { this.box.dispose(); this.puff.dispose(); for (const m of [this.glassMat, this.frameMat, this.chainMat, this.lockMat, this.sparkMat, this.barMat, this.smokeDark, this.smokeLight]) m.dispose(); }
}
