// Adapted from Bruno Simon folio-2025 World/Foliage.js (MIT).
// Adapted from Bruno Simon folio-2025 World/Bushes.js (MIT).
// Adapted from Bruno Simon folio-2025 World/Trees.js (MIT).
import { BufferGeometry, DataTexture, DoubleSide, Float32BufferAttribute, Frustum, Group, InstancedMesh, LinearFilter, Matrix4, Object3D, RGBAFormat, Sphere, Vector2, Vector3 } from 'three/webgpu';
import { attribute, min, mix, mx_noise_float, normalWorld, positionLocal, positionView, positionWorld, rotateUV, screenSize, screenUV, smoothstep, texture, uniform, uv, varying, vec2, vec3 } from 'three/tsl';
import { Rng } from '../core/Rng';
import { paletteTokens, type PaletteToken } from '../data/palette';
import type { Materials } from './Materials';
import type { View } from './View';
import type { windPhase } from './Grass';
import { seeThrough } from './SeeThrough';

/** Original leaf-cluster signed distance field, built from pointed oval leaves. No reference bitmap is shipped. */
export function leafClusterSdf(size = 128): Uint8Array {
  const rng = new Rng(71, 'own-leaf-cluster');
  const leaves = Array.from({ length: 64 }, (_, i) => {
    const angle = i * 2.399963, radius = .39 * Math.sqrt(i / 64), turn = angle + rng.next();
    return { x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, cos: Math.cos(turn), sin: Math.sin(turn), r: .047 + rng.next() * .02 };
  });
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let distance = -1;
    for (const leaf of leaves) {
      const dx = (x + .5) / size - leaf.x, dy = (y + .5) / size - leaf.y;
      const u = (dx * leaf.cos + dy * leaf.sin) / leaf.r;
      const v = (-dx * leaf.sin + dy * leaf.cos) / (leaf.r * .58);
      distance = Math.max(distance, (1 - Math.sqrt(u * u + v * v) - .13 * Math.abs(u * v)) * leaf.r);
    }
    const value = Math.round(Math.max(0, Math.min(1, .5 + distance * 9)) * 255);
    data.set([value, value, value, 255], (y * size + x) * 4);
  }
  return data;
}

/** Eighty cards, with a spatially uniform first forty for the low tier. Bent normals make the cluster read as one crown. */
export function crownGeometry(): BufferGeometry {
  const rng = new Rng(41, 'leaf-cards'), positions: number[] = [], normals: number[] = [], uvs: number[] = [], weights: number[] = [], indices: number[] = [];
  for (let i = 0; i < 80; i++) {
    const y = 1 - 2 * ((i % 40) + .5) / 40, angle = i * 2.399963;
    const r = .68 + rng.next() * .25, h = Math.sqrt(1 - y * y);
    const center = new Vector3(Math.cos(angle) * h, y, Math.sin(angle) * h).multiplyScalar(r);
    const turn = rng.next() * Math.PI * 2, size = .38 + rng.next() * .09;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const dx = (u - .5) * size * 2, dy = (v - .5) * size * 2;
      const p = center.clone().add(new Vector3(dx * Math.cos(turn) - dy * Math.sin(turn), dx * Math.sin(turn) + dy * Math.cos(turn), 0));
      const n = p.clone().normalize().lerp(center.clone().normalize(), .85).normalize();
      positions.push(...p.toArray()); normals.push(...n.toArray()); uvs.push(u, v); weights.push(.5 + y * .5);
    }
    const start = i * 4; indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const geometry = new BufferGeometry(); geometry.setIndex(indices);
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); geometry.setAttribute('leafWeight', new Float32BufferAttribute(weights, 1));
  geometry.computeBoundingSphere(); return geometry;
}

/** Small coherent Perlin gust; r2 can use the same node and phase for grass. */
export const foliageWind = (phase: ReturnType<typeof windPhase>) => mx_noise_float(vec3(positionWorld.xz.mul(.23), phase.mul(.28)));

interface Batch { mesh: InstancedMesh; references: Object3D[]; material: ReturnType<Materials['shaded']> }
export class Foliage extends Group {
  private readonly geometry = crownGeometry();
  private readonly sdf = new DataTexture(leafClusterSdf(), 128, 128, RGBAFormat);
  private readonly batches: Batch[] = [];
  private readonly player = seeThrough.center;
  private readonly target = uniform(new Vector2(-10, -10));
  private readonly playerDepth = seeThrough.depth;
  private readonly targetDepth = uniform(0);
  private readonly holeRadius = seeThrough.radius;
  private readonly frustum = new Frustum();
  private readonly projection = new Matrix4();
  private readonly bounds = new Sphere();
  private readonly point = new Vector3();
  private low = false;
  reveal = true;
  constructor(private readonly materials: Materials, private readonly phase: ReturnType<typeof windPhase>) {
    super(); this.name = 'leaf-card-crowns'; this.sdf.minFilter = this.sdf.magFilter = LinearFilter; this.sdf.needsUpdate = true;
  }
  /** Layout crown empties already contain their world position and three ellipsoid radii. */
  addCrowns(references: Object3D[], colors: [PaletteToken, PaletteToken], origin: [number, number]): void {
    if (!references.length) return;
    const gradient = normalWorld.y.mul(.5).add(.5).smoothstep(.15, .95);
    const material = this.materials.shaded(mix(this.materials.sample(uniform(paletteTokens.indexOf(colors[0]))), this.materials.sample(uniform(paletteTokens.indexOf(colors[1]))), gradient));
    const wind = foliageWind(this.phase).mul(this.materials.look.nodes.windStrength), gust = varying(wind);
    const leaf = texture(this.sdf, rotateUV(uv(), gust.mul(.12), vec2(.5))).r;
    const aspect = vec2(screenSize.x.div(screenSize.y), 1);
    const hole = (center: typeof this.player, depth: typeof this.playerDepth) => positionView.z.greaterThan(depth).select(smoothstep(this.holeRadius.mul(.55), this.holeRadius, screenUV.sub(center).mul(aspect).length()), 1);
    material.opacityNode = leaf.mul(min(hole(this.player, this.playerDepth), hole(this.target, this.targetDepth)));
    material.maskShadowNode = leaf.greaterThan(.5);
    material.alphaTest = .5; material.alphaToCoverage = !this.low; material.side = DoubleSide; material.transparent = false;
    material.positionNode = positionLocal.add(vec3(wind.mul(.035), 0, wind.mul(.02)).mul(attribute('leafWeight', 'float')));
    material.name = 'pal_leaf-card-crown';
    const mesh = new InstancedMesh(this.geometry, material, references.length); mesh.castShadow = !this.low; mesh.receiveShadow = true; mesh.frustumCulled = false;
    const facing = new Vector3(1, 1.38, 1).normalize();
    const refs = references.map((reference, i) => {
      const object = new Object3D(); object.position.copy(reference.position); object.position.x += origin[0]; object.position.z += origin[1]; object.scale.copy(reference.scale);
      object.up.set(Math.sin(i * 2.4), Math.cos(i * 2.4), 0); object.lookAt(object.position.clone().add(facing)); object.updateMatrix();
      object.matrix.makeRotationFromQuaternion(object.quaternion).premultiply(new Matrix4().makeScale(...reference.scale.toArray())).setPosition(object.position);
      object.userData.foliageMatrix = object.matrix.clone(); object.userData.foliageScaleY = object.scale.y; return object;
    });
    this.batches.push({ mesh, references: refs, material }); this.add(mesh);
  }
  /** Scale the authored crown about ground level; collision remains an authored asset property. */
  applyLook(): void {
    const height = this.materials.look.values.foliageHeight;
    for (const { references } of this.batches) for (const reference of references) {
      reference.matrix.copy(reference.userData.foliageMatrix);
      for (const row of [1, 5, 9, 13]) reference.matrix.elements[row] *= height;
      reference.position.y = reference.matrix.elements[13]; reference.scale.y = reference.userData.foliageScaleY * height;
    }
  }
  setQuality(low: boolean): void {
    this.low = low; this.geometry.setDrawRange(0, (low ? 40 : 80) * 6);
    for (const { mesh, material } of this.batches) {
      mesh.castShadow = !low;
      if (material.alphaToCoverage !== !low) { material.alphaToCoverage = !low; material.needsUpdate = true; }
    }
  }
  /** Reveal only foliage between the camera and the live combat subjects. Screen UV has a top-left origin. */
  update(view: View, player?: { x: number; y: number; z: number }, target?: { x: number; y: number; z: number }): void {
    const actorScale = view.camera.aspect < 1 ? 1.25 : 1;
    for (const [entity, center, depth] of [[player, this.player, this.playerDepth], [target, this.target, this.targetDepth]] as const) {
      if (!entity || !this.reveal) { center.value.set(-10, -10); depth.value = 0; continue; }
      // A card behind the chest can still occlude the legs: gate at the actor's
      // farthest body depth (feet plus shoe/backpack extent), independently of
      // the projected hole centre. The margin includes corners behind the root.
      this.point.set(entity.x, entity.y - .7, entity.z).applyMatrix4(view.camera.matrixWorldInverse); depth.value = this.point.z - .65;
      this.point.set(entity.x, entity.y - .7 + 1.15 * actorScale, entity.z).project(view.camera); center.value.set(this.point.x * .5 + .5, .5 - this.point.y * .5);
    }
    this.holeRadius.value = Math.min(.22, 3.25 * actorScale / view.radius);
    this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse));
    for (const { mesh, references } of this.batches) {
      let count = 0;
      const limit = Math.ceil(references.length * this.materials.look.values.foliageDensity);
      for (let i = 0; i < limit; i++) {
        const reference = references[i];
        this.bounds.center.copy(reference.position); this.bounds.radius = Math.max(reference.scale.x, reference.scale.y, reference.scale.z) * 1.45;
        if (this.frustum.intersectsSphere(this.bounds)) mesh.setMatrixAt(count++, reference.matrix);
      }
      mesh.count = count; mesh.visible = count > 0; if (count) mesh.instanceMatrix.needsUpdate = true;
    }
  }
  /** Depth-blind projected quad area, in multiples of the viewport. Includes discarded SDF pixels,
   * so it is a conservative fill-rate measure; divided by the crown pixel mask it bounds card overdraw.
   * Runs only when the debug snapshot is requested, never in the frame update. */
  private submittedCardScreenArea(): number {
    let area = 0; const positions = this.geometry.getAttribute('position'), matrix = new Matrix4(), transform = new Matrix4();
    const point = new Vector3();
    for (const { mesh } of this.batches) for (let instance = 0; instance < mesh.count; instance++) {
      mesh.getMatrixAt(instance, matrix); transform.multiplyMatrices(this.projection, matrix);
      for (let card = 0; card < (this.low ? 40 : 80); card++) {
        let polygon = Array.from({ length: 4 }, (_, i) => { point.fromBufferAttribute(positions, card * 4 + i).applyMatrix4(transform); return [point.x * .5 + .5, point.y * .5 + .5]; });
        for (const [axis, edge, above] of [[0, 0, true], [0, 1, false], [1, 0, true], [1, 1, false]] as const) {
          const clipped: number[][] = [];
          for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length];
            const inside = above ? a[axis] >= edge : a[axis] <= edge, next = above ? b[axis] >= edge : b[axis] <= edge;
            if (inside) clipped.push(a);
            if (inside !== next) { const t = (edge - a[axis]) / (b[axis] - a[axis]); clipped.push(a.map((v, k) => v + (b[k] - v) * t)); }
          }
          polygon = clipped;
        }
        area += Math.abs(polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return sum + a[0] * b[1] - a[1] * b[0]; }, 0)) * .5;
      }
    }
    return area;
  }
  getState() { return { density: this.materials.look.values.foliageDensity, height: this.materials.look.values.foliageHeight, windStrength: this.materials.look.values.windStrength, submittedCardScreenArea: this.submittedCardScreenArea(), crowns: this.batches.reduce((n, b) => n + b.references.length, 0), visible: this.batches.reduce((n, b) => n + b.mesh.count, 0), cardsPerCrown: this.low ? 40 : 80, playerHole: this.player.value.toArray(), targetHole: this.target.value.toArray(), holeRadius: this.holeRadius.value }; }
  dispose(): void { for (const { mesh, material } of this.batches) { mesh.dispose(); material.dispose(); } this.geometry.dispose(); this.sdf.dispose(); this.clear(); }
}
