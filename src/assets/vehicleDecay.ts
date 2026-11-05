import { Color, Mesh, type Material, type Object3D } from 'three/webgpu';
import type { AssetDef } from './types';

/** Authored variants take priority; catalog vehicles can reuse their intact shell. */
export function vehicleDecayFallback(def: AssetDef, decay?: string): boolean {
  return def.category === 'vehicle' && (decay === 'wrecked' || decay === 'burned') && !def.decayVariants.includes(decay);
}

/** Damage the imported swatches before palette conversion, without touching shared materials. */
export function applyVehicleDecay(root: Object3D, decay: string): void {
  const soot = new Color('#25222c'), copies = new Map<Material, Map<boolean, Material>>();
  root.userData.decayFallback = decay;
  root.traverse(node => {
    // Keep lamp anchors and lenses, but disable both their glow and runtime relighting.
    let lamp = false;
    for (let parent: Object3D | null = node; parent; parent = parent.parent) {
      if (/^(lights|siren)/i.test(parent.name)) { parent.userData.damagedLightOff = true; lamp = true; }
    }
    if (!(node instanceof Mesh)) return;
    const damage = (source: Material): Material => {
      const light = lamp || source.name.startsWith('emi_');
      let variants = copies.get(source);
      if (!variants) { variants = new Map(); copies.set(source, variants); }
      let copy = variants.get(light);
      if (copy) return copy;
      copy = source.clone();
      const colored = copy as Material & { color?: Color; emissive?: Color; emissiveIntensity?: number };
      if (colored.color) colored.color.lerp(soot, light || decay === 'burned' ? 1 : .88);
      colored.emissive?.set(0); colored.emissiveIntensity = 0;
      // Non-palette names retain these damaged swatches through AssetMaterials.swap.
      copy.name = `damage_${decay}_${source.name}`; copy.userData.emissiveStrength = 0;
      variants.set(light, copy); return copy;
    };
    node.material = Array.isArray(node.material) ? node.material.map(damage) : damage(node.material);
  });
}
