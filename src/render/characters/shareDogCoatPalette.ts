import { BufferAttribute, type BufferGeometry } from 'three/webgpu';
import type { CrowdClip } from '../../assets/crowd';
/** Only palette variants with identical surfaces and poses may share an animated draw. */
export function shareDogCoatPalette(base: BufferGeometry, cream: BufferGeometry, baseClip: CrowdClip, creamClip: CrowdClip): boolean {
  if (baseClip.frames !== creamClip.frames || baseClip.duration !== creamClip.duration || baseClip.parts.join('/') !== creamClip.parts.join('/') || baseClip.matrices.length !== creamClip.matrices.length || !baseClip.matrices.every((v, i) => v === creamClip.matrices[i])) return false;
  for (const name of ['position', 'normal', '_parts', 'index']) {
    const a = name === 'index' ? base.getIndex() : base.getAttribute(name), b = name === 'index' ? cream.getIndex() : cream.getAttribute(name);
    if (!a || !b || a.itemSize !== b.itemSize || a.normalized !== b.normalized || a.array.length !== b.array.length || !Array.from(a.array).every((v, i) => v === b.array[i])) return false;
  }
  const colors = cream.getAttribute('color');
  if (!colors || colors.itemSize !== 3 || colors.count !== base.getAttribute('color').count) return false;
  // Independent GPU attribute ownership; the authored immutable CPU colors remain shared.
  base.setAttribute('_dogCream', new BufferAttribute(colors.array, 3, colors.normalized));
  return true;
}
