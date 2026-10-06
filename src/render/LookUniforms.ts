import { Color, type UniformNode } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { worldLook, type WorldLook } from '../data/worldLook';
import { palette, type PaletteToken } from '../data/palette';
import { exportLookPatch, validateLookPatch, type LookPatch } from '../data/lookPatch';

type LookNodes = { [K in keyof WorldLook]: WorldLook[K] extends number ? UniformNode<'float', number> : UniformNode<'color', Color> };
/** Per-view render-only state. Uniform identity survives edits, level loads and quality changes. */
export class LookUniforms {
  readonly values: WorldLook = { ...worldLook };
  readonly palette: Record<PaletteToken, string> = { ...palette };
  readonly nodes = Object.fromEntries(Object.entries(worldLook).map(([key, value]) => [key, typeof value === 'number' ? uniform(value) : uniform(new Color(value))])) as LookNodes;
  private overrides: Partial<WorldLook> = {};
  has(key: keyof WorldLook): boolean { return Object.hasOwn(this.overrides, key); }
  set(input: LookPatch): void {
    const patch = validateLookPatch(input, this.values);
    Object.assign(this.values, patch.worldLook); Object.assign(this.overrides, patch.worldLook); Object.assign(this.palette, patch.palette);
    this.sync();
  }
  reset(): void { Object.assign(this.values, worldLook); Object.assign(this.palette, palette); this.overrides = {}; this.sync(); }
  private sync(): void {
    for (const key of Object.keys(this.values) as (keyof WorldLook)[]) {
      const node = this.nodes[key], value = this.values[key];
      if (node.value instanceof Color && typeof value === 'string') node.value.set(value);
      else if (typeof value === 'number') node.value = value;
    }
  }
  export(): LookPatch { return exportLookPatch(this.values, this.palette); }
}
