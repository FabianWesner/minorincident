// Adapted from Bruno Simon folio-2025 Confetti.js, Leaves.js, Trails.js and Noises.js (MIT, 41046b5).
import { Color, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicNodeMaterial, PlaneGeometry, type Node, DepthTexture, ViewportDepthTextureNode, TextureLoader, SRGBColorSpace, type Texture } from 'three/webgpu';
import manifest from '../../assets/manifest.json' with { type: 'json' };
import type { AssetDef } from '../../assets/types';
import { atan, texture, attribute, cameraWorldMatrix, cos, float, Fn, mix, positionGeometry, sin, uniform, uv, vec2, vec3, vec4, linearDepth } from 'three/tsl';

/** Half a 60 Hz interval: a fresh shot remains in view on its first advancing frame at closest zoom. */
export const tracerLaunchS = 1 / 120;
/** Shared quad silhouettes. Spark/drop aspect is trail length in metres; gravity remains ballistic. */
export const particleShape = { tracer: 11, spark: 12, flash: 13, smoke: 14, drop: 15 } as const;
export const groundShape = { pressure: 12, scorch: 13 } as const;

/** Track every canvas/render-target depth copy, including compiler-created node clones. */
class OwnedDepth extends ViewportDepthTextureNode {
  private readonly copies = new Set<Texture>();
  constructor(uvNode?: Node, levelNode?: Node | null, source: Texture = new DepthTexture(1, 1)) {
    super(uvNode, levelNode, source as DepthTexture); this.copies.add(source);
  }
  override getTextureForReference(reference?: Parameters<ViewportDepthTextureNode['getTextureForReference']>[0]): Texture {
    const copy = super.getTextureForReference(reference);
    const owner = this.referenceNode instanceof OwnedDepth ? this.referenceNode : this;
    owner.copies.add(copy); return copy;
  }
  dispose(): void { for (const copy of this.copies) copy.dispose(); this.copies.clear(); }
}

/** Fixed GPU slots. Only spawn writes attributes; ballistic motion, fading and noise run in TSL.
 * Ground shapes: 0 splat, 1 ring, 2 lane, 3 chevron, 4 cross. Particles use billboards.
 * Warning pools use motion.y for wind-up seconds; their clock animates fixed slots without CPU writes.
 * Light-field consumers (E25/E27) may supply a world-position sampling node at construction. */
export class FxPool {
  readonly clock = uniform(0);
  readonly pulse = uniform(1);
  readonly emission = uniform(1);
  readonly mesh: InstancedMesh;
  private readonly origin: InstancedBufferAttribute;
  private readonly motion: InstancedBufferAttribute;
  private readonly visibility: InstancedBufferAttribute;
  private readonly style: InstancedBufferAttribute;
  private readonly colors: InstancedBufferAttribute;
  private readonly expires: Float64Array;
  private readonly tint = new Color();
  private readonly depthNode: OwnedDepth | null;
  private readonly bloodTextures: Texture[];
  private cursor = 0;
  budget: number;
  constructor(readonly cap: number, readonly mode: 'particle' | 'ground' | 'wall', lightSample?: Node<'vec3'>, bloodDecals = false, warnings = false) {
    this.budget = cap;
    this.visibility = new InstancedBufferAttribute(new Float32Array(cap).fill(1), 1).setUsage(DynamicDrawUsage);
    this.bloodTextures = bloodDecals && typeof document !== 'undefined' ? ['splats', 'pool', 'trail'].map(kind => {
      const def = (manifest as AssetDef[]).find(asset => asset.id === `decal.blood-${kind}`)!;
      const map = new TextureLoader().load('/' + def.decalTexture!.replace(/^public\//, ''));
      map.colorSpace = SRGBColorSpace; return map;
    }) : [];
    this.depthNode = mode === 'particle' ? new OwnedDepth() : null;
    const geometry = new PlaneGeometry(1, 1);
    this.origin = new InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(DynamicDrawUsage);
    this.motion = new InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(DynamicDrawUsage);
    this.style = new InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(DynamicDrawUsage);
    this.colors = new InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(DynamicDrawUsage);
    geometry.setAttribute('fxOrigin', this.origin); geometry.setAttribute('fxMotion', this.motion);
    geometry.setAttribute('fxVisibility', this.visibility);
    geometry.setAttribute('fxStyle', this.style); geometry.setAttribute('fxColor', this.colors);
    const origin = attribute('fxOrigin', 'vec4'), motion = attribute('fxMotion', 'vec4'), style = attribute('fxStyle', 'vec4');
    const age = this.clock.sub(origin.w), life = motion.w.max(0.001), progress = age.div(life).clamp(0, 1);
    // Slots are born at the current clock, never scheduled in the future. Testing age >= 0
    // in the fragment shader creates holes when interpolated birth time rounds above now.
    const alive = age.lessThan(life).and(motion.w.greaterThan(0)).select(1, 0);
    const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
    // Premultiplied output: ordinary particles occlude normally; tracer RGB adds with
    // zero alpha in the SAME instanced draw (no separate material/mesh or depth copy).
    if (mode === 'particle') {
      material.blending = CustomBlending; material.blendSrc = OneFactor; material.blendDst = OneMinusSrcAlphaFactor;
    }
    material.positionNode = Fn(() => {
      const size = style.x.mul(alive);
      if (mode === 'particle') {
        const shape = style.y.add(.5).floor();
        const smokeSize = shape.equal(particleShape.smoke).select(progress.mul(.55).add(.45), 1);
        const billboard = cameraWorldMatrix.mul(vec4(positionGeometry.xy.mul(size).mul(smokeSize), 0, 0)).xyz;
        const offset = motion.xyz.mul(age.max(0));
        const ordinary = origin.xyz.add(offset).add(vec3(0, age.max(0).pow(2).mul(style.z).mul(-0.5), 0)).add(billboard);
        // Camera-plane ballistic tangent: no CPU updates, and no unstable cross product when viewed end-on.
        const right = cameraWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz;
        const up = cameraWorldMatrix.mul(vec4(0, 1, 0, 0)).xyz;
        const velocity = motion.xyz.sub(vec3(0, age.max(0).mul(style.z), 0));
        const projected = vec2(velocity.dot(right), velocity.dot(up));
        const axis = projected.add(vec2(.0001, 0)).normalize();
        const trail = style.w.min(projected.length().mul(.045)).max(size);
        const local = axis.mul(positionGeometry.x.mul(trail)).add(vec2(axis.y.negate(), axis.x).mul(positionGeometry.y.mul(size)));
        const ballistic = ordinary.sub(billboard).add(right.mul(local.x)).add(up.mul(local.y));
        // Shape 11: one camera-facing ribbon along the 3D bullet ray. style.z is
        // the hit distance, style.w the width. Clip both ends to muzzle/hit.
        const speed = motion.xyz.length().max(.001), direction = motion.xyz.div(speed);
        const head = age.sub(tracerLaunchS).max(0).mul(speed).min(style.z), length = style.x.min(head);
        const forward = cameraWorldMatrix.mul(vec4(0, 0, 1, 0)).xyz;
        const side = direction.cross(forward), across = side.div(side.length().max(.001));
        const streak = origin.xyz.add(direction.mul(head.sub(length.mul(.5)).add(positionGeometry.x.mul(length))))
          .add(across.mul(positionGeometry.y.mul(style.w))).mul(alive).add(origin.xyz.mul(float(1).sub(alive)));
        return shape.equal(particleShape.tracer).select(streak, shape.equal(particleShape.spark).or(shape.equal(particleShape.drop)).select(ballistic, ordinary));
      }
      const growth = style.z.greaterThan(0).select(progress.mul(2).min(1), 1);
      const x = positionGeometry.x.mul(size).mul(growth), z = positionGeometry.y.mul(size).mul(style.w).mul(growth);
      if (mode === 'wall') return origin.xyz.add(vec3(x.mul(cos(motion.x)), z, x.mul(sin(motion.x))));
      return origin.xyz.add(vec3(x.mul(cos(motion.x)).sub(z.mul(sin(motion.x))), 0, x.mul(sin(motion.x)).add(z.mul(cos(motion.x)))));
    })();
    material.outputNode = Fn(() => {
      const p = uv().sub(0.5).mul(2), r = p.length();
      // Bruno's sine/dot hash, animated analytically: no flipbook or per-emission textures.
      const noise = sin(p.x.mul(127.1).add(p.y.mul(311.7)).add(mode === 'particle' ? age.mul(2) : 0)).mul(43758.5453).fract();
      let mask;
      let color: Node<'vec3'> = attribute('fxColor', 'vec3');
      if (mode === 'particle') {
        const edge = float(1).sub(r).max(0).pow(1.5);
        const depth = linearDepth(this.depthNode!).sub(linearDepth()).mul(150).clamp(0, 1);
        const shape = style.y.add(.5).floor();
        // Broad lobes move coherently; dust expands within its original maximum footprint.
        const lobe = sin(p.x.mul(5).add(origin.x)).mul(sin(p.y.mul(5).add(origin.z))).mul(.1);
        const billow = float(1).sub(r.add(lobe).smoothstep(.45, .98));
        const star = float(1).sub(p.x.abs().mul(p.y.abs()).mul(32).add(r.mul(.7))).clamp(0, 1).pow(2);
        const streakMask = float(1).sub(p.y.abs()).max(0).pow(1.5).mul(float(1).sub(p.x.abs()).max(0));
        const drop = float(1).sub(vec2(p.x, p.y.mul(p.x.mul(.3).add(1.2))).length()).clamp(0, 1).smoothstep(0, .35);
        mask = shape.equal(particleShape.smoke).select(billow, shape.equal(particleShape.flash).select(star,
          shape.equal(particleShape.spark).select(streakMask, shape.equal(particleShape.drop).select(drop, edge.mul(mix(.65, 1, noise)))))).mul(depth);
      } else {
        const splat = r.lessThan(float(0.84).add(noise.mul(0.16))).select(1, 0);
        const thinRing = r.lessThan(1).and(r.greaterThan(float(1).sub(float(.4).div(style.x)))).select(1, 0);
        const ring = r.lessThan(1).and(r.greaterThan(0.82)).select(1, 0);
        const lane = p.x.abs().greaterThan(0.82).or(p.y.abs().greaterThan(0.82)).select(1, 0);
        const chevron = p.y.sub(p.x.abs().mul(0.7)).abs().lessThan(0.16).select(1, 0);
        const cross = p.x.abs().lessThan(0.18).or(p.y.abs().lessThan(0.18)).select(1, 0);
        // Shape is a discrete instance value; round after interpolation to avoid equality speckle.
        const shape = style.y.add(0.5).floor();
        const rearArc = thinRing.mul(p.x.greaterThanEqual(r.mul(Math.SQRT1_2)).select(1, 0));
        const arc = thinRing.mul(p.x.greaterThanEqual(r.mul(.5)).select(1, 0));
        mask = shape.equal(10).select(rearArc, shape.equal(9).select(arc, shape.equal(8).select(thinRing, shape.equal(1).select(ring, shape.equal(2).select(lane, shape.equal(3).select(chevron, shape.equal(4).select(cross, splat)))))));
        if (!warnings) {
          const breakup = sin(p.x.mul(19).add(p.y.mul(11))).mul(.1).add(.9);
          // Bright leading edge over a broader feathered dust band behind it.
          const pressure = r.smoothstep(.6, .86).mul(.5).add(r.smoothstep(.8, .88).mul(.5)).mul(float(1).sub(r.smoothstep(.965, 1))).mul(breakup);
          const angle = atan(p.y, p.x);
          const radial = sin(angle.mul(13)).mul(sin(angle.mul(7).add(1))).mul(.16);
          const scorch = float(1).sub(r.add(radial).smoothstep(.25, .96)).mul(.8);
          mask = shape.equal(groundShape.pressure).select(pressure, shape.equal(groundShape.scorch).select(scorch, mask));
        }
        if (warnings) {
          // World-sized fine strokes: the band marks the hit area without hiding the road.
          // +X is the locked charge direction; repeating open chevrons sweep toward its end.
          const windup = age.div(motion.y.max(.001)).clamp(0, 1);
          const stroke = float(.12).div(style.x).min(.12);
          const rim = r.lessThan(1).and(r.greaterThan(float(1).sub(stroke.mul(2)))).select(1, 0);
          const fill = r.lessThan(windup).select(.18, .045);
          const ringWarning = rim.mul(.65).add(r.lessThan(1).select(fill, 0));
          const across = p.y.abs();
          const stripe = p.x.mul(style.x.mul(.5)).add(across.mul(.5)).sub(age.mul(2.4)).div(1.5).fract();
          const chevrons = stripe.lessThan(.10).and(across.lessThan(.72)).select(.48, 0);
          const edges = across.greaterThan(float(1).sub(float(.12).div(style.x.mul(style.w).mul(.5).max(.1)))).select(.55, 0);
          const laneWarning = edges.max(chevrons).add(p.x.lessThan(windup.mul(2).sub(1)).select(.16, .045));
          const beat = sin(age.mul(Math.PI * 4)).mul(.07).mul(this.pulse).add(.86);
          const animated = shape.equal(2).or(shape.equal(3)).select(laneWarning, ringWarning)
            .mul(windup.mul(.25).add(.65)).mul(beat).min(.68);
          mask = shape.equal(1).or(shape.equal(2)).or(shape.equal(3)).or(shape.equal(8)).select(animated, mask.mul(.65));
        }
        if (this.bloodTextures.length) {
          const [splats, pool, trail] = this.bloodTextures.map(map => texture(map));
          const blood = shape.equal(6).select(pool, shape.equal(7).select(trail, splats));
          const isBlood = shape.greaterThanEqual(5).and(shape.lessThanEqual(7));
          mask = isBlood.select(blood.a, mask); color = isBlood.select(blood.rgb, color);
        }
      }
      const fade = float(1).sub(progress).min(1).mul(alive).mul(attribute('fxVisibility', 'float'));
      const lit = lightSample ?? vec3(1);
      if (mode === 'particle') {
        const shape = style.y.add(.5).floor(), tracer = shape.equal(particleShape.tracer);
        const ribbon = float(1).sub(p.y.abs()).max(0).pow(.7).mul(uv().x.mul(.7).add(.3));
        const flight = age.sub(tracerLaunchS).max(0).div(life.sub(tracerLaunchS).max(.001)).clamp(0, 1);
        const endFade = float(1).sub(flight).mul(5).clamp(0, 1);
        const opacity = tracer.select(ribbon.mul(endFade).mul(alive), mask.mul(fade));
        const emissive = shape.equal(particleShape.spark).or(shape.equal(particleShape.flash));
        const hot = color.r.greaterThan(color.b).select(mix(color, vec3(1, .16, .015), progress.mul(.85)), color).mul(this.emission).mul(2.2);
        // Round 3: the tracer ribbon is HDR with a white-hot centre line, so bloom gives it punch at the pinned length and width.
        const bolt = mix(color, vec3(1, .97, .9), float(1).sub(p.y.abs()).pow(5)).mul(this.emission.max(.5)).mul(2.6);
        return vec4(tracer.select(bolt, emissive.select(hot, color.mul(lit))).mul(opacity), tracer.or(emissive).select(0, opacity));
      }
      return vec4(color.mul(lit), mask.mul(fade));
    })();
    // Empty particle draws still copy viewport depth; omit them until an effect spawns.
    this.mesh = new InstancedMesh(geometry, material, cap); this.mesh.frustumCulled = false; this.mesh.visible = false;
    this.mesh.renderOrder = mode === 'ground' ? 1 : 2;
    const identity = new Matrix4(); for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, identity);
    this.expires = new Float64Array(cap);
  }
  /** Accessibility palette changes preserve live telegraph geometry and lifetime. */
  recolor(slot: number, color: number): void { this.tint.setHex(color); this.colors.setXYZ(slot, this.tint.r, this.tint.g, this.tint.b); this.colors.needsUpdate = true; }
  /** Returns a stable slot index (-1: `preserveLive` and the pool is full); callers retain it only for attack-lifetime telegraphs. */
  spawn(now: number, life: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, shape: number, color: number, gravity = 0, aspect = 1, preserveLive = false): number {
    let slot = this.cursor++ % this.budget;
    if (preserveLive) {
      let searched = 0;
      while (this.expires[slot] > now && searched++ < this.budget) slot = (slot + 1) % this.budget;
      // Brief l3-polish (L3 real-input run crashed here with the 5x hordes on the police line): more live telegraphs than the pool
      // holds (many sim ticks between two render frames) skip the extra tell instead of stopping the game.
      if (this.expires[slot] > now) return -1;
    }
    this.origin.setXYZW(slot, x, y, z, now); this.motion.setXYZW(slot, vx, vy, vz, life);
    this.style.setXYZW(slot, size, shape, gravity, aspect);
    this.tint.setHex(color); this.colors.setXYZ(slot, this.tint.r, this.tint.g, this.tint.b);
    this.visibility.setX(slot, 1); this.visibility.needsUpdate = true;
    this.expires[slot] = now + life;
    this.origin.needsUpdate = this.motion.needsUpdate = this.style.needsUpdate = this.colors.needsUpdate = true;
    this.mesh.visible = true;
    return slot;
  }
  /** Fade a warning without touching its lifetime, dimensions, or pooled identity. */
  opacity(slot: number, value: number): void { this.visibility.setX(slot, value); this.visibility.needsUpdate = true; }
  remove(slot: number): void { this.expires[slot] = 0; this.motion.setW(slot, 0); this.motion.needsUpdate = true; this.mesh.visible = this.count > 0; }
  advance(now: number): void { this.clock.value = now; this.mesh.visible = this.count > 0; }
  get count(): number { let n = 0; for (const expiry of this.expires) if (expiry > this.clock.value) n++; return n; }
  reset(now = 0): void { this.expires.fill(0); this.motion.array.fill(0); this.motion.needsUpdate = true; this.cursor = 0; this.clock.value = now; this.mesh.visible = false; }
  dispose(): void {
    this.depthNode?.dispose();
    for (const texture of this.bloodTextures) texture.dispose();
    this.mesh.dispose(); this.mesh.geometry.dispose(); (this.mesh.material as MeshBasicNodeMaterial).dispose(); }
}
