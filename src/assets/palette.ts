import tokens from './palette.json';
/** Shared art-direction tokens; also read by Blender. */
export const palette: Record<string, string> = tokens;
export function validMaterial(name: string): boolean {
  // tex_: textured 3D-pipeline figures (Materials.fromTexture); the map carries the colour.
  if (/^tex_(baseColor|vertexColor)$/.test(name)) return true;
  const match = name.match(/^(pal|emi|keep)_(.+)$/);
  return !!match && (match[1] === 'keep' ? ['glass', 'neon'].includes(match[2]) : Object.hasOwn(palette,match[2]));
}
