import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BufferGeometry, MeshBasicNodeMaterial, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshLambertNodeMaterial } from 'three/webgpu';

/** 48 overlay triangles at every LOD, appended to the existing transport roof draw. Local coordinates match the shared unarmed APC. */
export class ApcDamage extends Group {
  readonly dents: Mesh;
  readonly glass: Mesh;
  private readonly lamps: { material: import('three').Material & { color: Color }; color: Color; brake: boolean }[] = [];
  private roof?: Mesh;
  private roofVertices = 0;
  private dentVertices = 0;
  stage = 0;
  lightsOn = true;
  constructor(model: import('three').Object3D) {
    super(); this.name = 'apc-damage';
    const positions: number[] = [], colors: number[] = [];
    const triangle = (a: number[], b: number[], c: number[], hex: string) => {
      positions.push(...a, ...b, ...c); const rgb = new Color(hex).toArray(); colors.push(...rgb, ...rgb, ...rgb);
    };
    // Broad buckled panel scars: a dark recessed centre and a pale folded edge, on both flanks and bonnet.
    for (const side of [-1, 1]) for (const x of [-.55, .55]) {
      const z = side * (x > 0 ? 1.28 : 1.24);
      triangle([x-.38,1.48,z], [x+.32,1.36,z], [x+.12,1.67,z], '#393d2b');
      triangle([x-.38,1.48,z], [x+.12,1.67,z], [x-.22,1.72,z], '#b1ad7b');
      triangle([x-.38,1.48,z], [x+.32,1.36,z], [x-.1,1.40,z], '#777559');
    }
    for (const z of [-.65,.55]) {
      triangle([2.15,1.676,z-.25], [2.6,1.403,z], [2.32,1.573,z+.25], '#383b2b');
      triangle([2.15,1.676,z-.25], [2.32,1.573,z+.25], [2.2,1.646,z+.30], '#b1ad7b');
    }
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    this.dents = new Mesh(geometry, new MeshLambertNodeMaterial({ vertexColors: true, side: DoubleSide })); this.add(this.dents);
    const cracks: number[] = [];
    const line = (a: number[], b: number[], width: number, axis: number) => {
      const aa = [...a], bb = [...b]; aa[axis] += width; bb[axis] += width;
      cracks.push(...a,...b,...aa,...aa,...b,...bb);
    };
    // Vision blocks on the sloped glacis (the original glass survives all authored LODs).
    for (const z of [-.48,.48]) for (const [dz,dy] of [[-.21,.06],[.22,-.05],[-.12,-.055],[.13,.065]]) {
      const y = 2.015 + dy; line([1.783,2.015,z], [1.783-dy*.61,y,z+dz], .025, 2);
    }
    // Fallback transport glazing: roof and side panes remain readable behind these sparse cracks.
    for (const z of [-1.274,1.274]) for (const [dx,dy] of [[-.34,.22],[.32,-.20],[-.24,-.18],[.18,.25]]) line([.72,1.95,z],[.72+dx,1.95+dy,z],.035,0);
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(cracks,3)); g.computeVertexNormals();
    const crackColor = new Color('#d1ded5').toArray(); g.setAttribute('color', new Float32BufferAttribute(Array.from({ length: cracks.length / 3 }, () => crackColor).flat(), 3));
    this.glass = new Mesh(g, this.dents.material); this.add(this.glass);
    const roof = model.getObjectByName('transportRoof');
    if (roof instanceof Mesh) {
      // Append overlays to the existing roof draw. Draw ranges accumulate without a material or draw per stage.
      this.roof = roof; const base = roof.geometry.toNonIndexed(); base.deleteAttribute('uv');
      this.roofVertices = base.getAttribute('position').count; this.dentVertices = geometry.getAttribute('position').count;
      for (const overlay of [geometry,g]) {
        const count = overlay.getAttribute('position').count;
        overlay.setAttribute('cabOpacity', new Float32BufferAttribute(new Float32Array(count).fill(1),1));
        // Broken glass catches moonlight even on the shaded flank; the intact pane and armor stay unlit.
        overlay.setAttribute('cabCrack', new Float32BufferAttribute(new Float32Array(count).fill(overlay === g ? 1 : 0),1));
      }
      const merged = mergeGeometries([base,geometry,g])!; base.dispose(); roof.geometry.dispose(); roof.geometry = merged;
      this.remove(this.dents,this.glass);
    }
    const seen = new Set<import('three').Material>();
    for (const name of ['lightsFront','lightsBrake']) model.getObjectByName(name)?.traverse(node => {
      if (!(node instanceof Mesh)) return;
      // Lamps must be owned by this vehicle; the registry's shared emitting material cannot be extinguished globally.
      const own = (material: import('three').Material) => {
        const original = material as import('three').Material & { color?: Color };
        const glow = (original.color ?? new Color('#ffffff')).clone(), strength = Number(original.userData.emissiveStrength ?? 0);
        // Preserve E25's luminance-normalized HDR emission when replacing the shared palette shader.
        if (strength > 0) glow.multiplyScalar(strength / Math.max(.001, .2126 * glow.r + .7152 * glow.g + .0722 * glow.b));
        const copy = new MeshBasicNodeMaterial({ color: glow }); if ('color' in copy && !seen.has(copy)) { const m = copy as typeof this.lamps[number]['material']; this.lamps.push({ material: m, color: m.color.clone(), brake: name === 'lightsBrake' }); seen.add(copy); } return copy;
      };
      // A single-material GLTF mesh has no geometry groups: converting it to an array would omit its draw.
      node.material = Array.isArray(node.material) ? node.material.map(own) : own(node.material);
    });
    model.add(this); this.update(0,0);
  }
  update(stage: number, tick: number, braking = false): void {
    if (this.roof) this.roof.geometry.setDrawRange(0, this.roofVertices + (stage >= 1 ? this.dentVertices : 0) + (stage >= 2 ? this.glass.geometry.getAttribute('position').count : 0));
    this.stage = stage; this.dents.visible = stage >= 1; this.glass.visible = stage >= 2;
    this.lightsOn = stage < 3 || stage === 3 && Math.floor(tick / 9) % 7 === 0;
    for (const lamp of this.lamps) lamp.material.color.copy(lamp.color).multiplyScalar(this.lightsOn ? lamp.brake ? braking ? 4 : .15 : 1 : 0);
  }
  snapshot() { return { stage: this.stage, dents: this.dents.visible, glass: this.glass.visible, lightsOn: this.lightsOn, smoke: this.stage >= 3 ? this.stage === 4 ? 'heavy' : 'light' : 'none', overlayTriangles: (this.dents.geometry.getAttribute('position').count + this.glass.geometry.getAttribute('position').count) / 3 }; }
  dispose(): void { for (const mesh of [this.dents,this.glass]) { mesh.geometry.dispose(); } (this.dents.material as MeshLambertNodeMaterial).dispose(); for (const lamp of this.lamps) lamp.material.dispose(); this.removeFromParent(); }
}
