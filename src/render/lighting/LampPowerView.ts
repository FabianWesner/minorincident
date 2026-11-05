import { DataTexture, NearestFilter, RGBAFormat, UnsignedByteType, type Node } from 'three/webgpu';
import { texture, vec2 } from 'three/tsl';
import type { LightAnchor } from '../../data/lights';
import type { LightPower } from '../../sim/lighting/LightPower';

/** One byte per anchor, shared by all placement LODs. Texel zero is the
 * always-on fallback for emissives without a gameplay light anchor. */
export class LampPowerView {
  private readonly bytes = new Uint8Array(16384 * 4).fill(255);
  readonly texture = new DataTexture(this.bytes, 256, 64, RGBAFormat, UnsignedByteType);
  state: LightPower | null = null;
  private readonly addresses = new Map<string, number>();
  private next = 1;
  constructor() { this.texture.minFilter = this.texture.magFilter = NearestFilter; this.texture.needsUpdate = true; }
  sample(index: Node<'float'>): Node<'float'> { return texture(this.texture, vec2(index.mod(256).add(.5).div(256), index.div(256).floor().add(.5).div(64))).r; }
  base(id: string, anchors: readonly LightAnchor[]): number {
    const known = this.addresses.get(id); if (known !== undefined) return known;
    const base = this.next, prefix = id.slice(0, id.length - anchors[0].name.length);
    for (const anchor of anchors) this.addresses.set(prefix + anchor.name, this.next++);
    if (this.next >= 16384) throw new Error('Light anchor texture capacity exceeded');
    return base;
  }
  update(): void {
    let changed = false;
    for (const [id, address] of this.addresses) {
      const offset = address * 4;
      if (offset >= this.bytes.length) throw new Error('Light anchor texture capacity exceeded');
      const value = this.state?.isOn(id) ? 255 : 0;
      if (this.bytes[offset] !== value) { this.bytes[offset] = value; changed = true; }
    }
    if (changed) this.texture.needsUpdate = true;
  }
  snapshot() { return [...(this.state?.lamps.values() ?? [])].map(lamp => ({ id: lamp.id, position: [lamp.x, lamp.y, lamp.z], group: lamp.group, broken: lamp.broken, emissive: this.bytes[(this.addresses.get(lamp.id) ?? 0) * 4] / 255 })); }
  dispose(): void { this.texture.dispose(); }
}
