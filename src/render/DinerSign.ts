import { CanvasTexture, Group, Mesh, MeshLambertNodeMaterial, PlaneGeometry, SRGBColorSpace } from 'three/webgpu';

/** Artwork on both faces of the delivered curb board. Separate from simplified
 * building geometry so lettering remains readable at every district LOD. */
export function dinerSign() {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#182333'; ctx.fillRect(0, 0, 768, 512);
  ctx.strokeStyle = '#f8bf70'; ctx.lineWidth = 12; ctx.strokeRect(14, 14, 740, 484);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe6b3'; ctx.font = 'bold 94px Georgia, serif'; ctx.fillText("Joe's Diner", 384, 158, 700);
  ctx.strokeStyle = '#ed7770'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(158, 274, 452, 158, 30); ctx.stroke();
  ctx.shadowColor = '#ff625e'; ctx.shadowBlur = 10;
  ctx.font = 'bold 112px sans-serif'; ctx.strokeStyle = '#ff8b80'; ctx.lineWidth = 4; ctx.strokeText('OPEN', 384, 354);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  const material = new MeshLambertNodeMaterial({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: 2 });
  material.name = 'diner-sign-neon';
  const geometry = new PlaneGeometry(2.7, 1.8), root = new Group();
  // Catalog-local coordinates of the freestanding board, clear of its existing faces.
  for (const [x, direction] of [[1.39, 1], [1.10, -1]]) {
    const face = new Mesh(geometry, material); face.name = 'diner-sign-art';
    face.position.set(x, 2.24, 4.2175); face.rotation.y = direction * Math.PI / 2; root.add(face);
  }
  return { root, geometry, material, texture };
}
