/** E25 light anchor contract (specs/06 §6) and light palette (§7). Shared by the build tool and the runtime. */
export const lightPalette = {
  light_sun_noon: '#fff4e0', light_sun_golden: '#ffb066', light_moon: '#9fb4ff',
  light_sodium: '#ffa94d', light_led_white: '#fff1d6', light_fluorescent: '#e8fff4', light_window_warm: '#ffc773',
  light_neon_pink: '#ff4fa3', light_neon_blue: '#4f8bff', light_neon_green: '#4dff9a',
  light_siren_red: '#ff2d2d', light_siren_blue: '#2f6bff', light_fire: '#ff7a1a', light_muzzle: '#ffd27a',
  light_toxic: '#a6ff4d', light_spark: '#bfe3ff',
} as const;
export type LightToken = keyof typeof lightPalette;
export const lightTypes = ['spot', 'point', 'area', 'window', 'beacon', 'fire', 'neon'] as const;
export type LightType = typeof lightTypes[number];

/** One `light:*` empty, in its asset's glTF frame (+Y up, metres). `direction` is the empty's Blender local -Z. */
export interface LightAnchor {
  name: string;
  position: [number, number, number];
  direction: [number, number, number];
  type: LightType;
  color: LightToken;
  intensity: number;
  range: number;
  angle?: number;
  pool: boolean;
  beam: 'none' | 'soft' | 'strong';
  reflect: boolean;
  shadow: 'none' | 'hero';
  heroPriority: number;
  flicker: 'none' | 'fluorescent' | 'fire' | 'damaged' | 'startup';
  strobe?: string;
  rotate?: number;
  powerGroup: string;
  breakable: boolean;
  /** Mesh nodes whose emi_* material follows this light (validated at build, not shipped). */
  emissiveNodes?: string[];
}

const num = (value: unknown, fallback: number): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Exports store `ss_light` as a JSON string or an object; missing optional fields take the §6 defaults. */
export function parseLight(name: string, raw: unknown, position: [number, number, number], direction: [number, number, number]): { anchor: LightAnchor; errors: string[] } {
  const errors: string[] = [];
  let data: Record<string, unknown> = {};
  try { data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>; } catch { errors.push(`${name}: ss_light is not valid JSON`); }
  if (!data || typeof data !== 'object') { errors.push(`${name}: ss_light is not an object`); data = {}; }
  const animation = (data.animation ?? null) as { strobe?: string; rotate?: number } | null;
  const anchor: LightAnchor = {
    name, position, direction,
    type: data.type as LightType, color: data.color as LightToken,
    intensity: num(data.intensity, NaN), range: num(data.range, NaN),
    ...(typeof data.angle === 'number' ? { angle: data.angle } : {}),
    pool: data.pool !== false, beam: (data.beam ?? 'none') as LightAnchor['beam'], reflect: data.reflect === true,
    shadow: (data.shadow ?? 'none') as LightAnchor['shadow'], heroPriority: num(data.heroPriority, 0),
    flicker: (data.flicker ?? 'none') as LightAnchor['flicker'],
    ...(animation?.strobe ? { strobe: animation.strobe } : {}), ...(typeof animation?.rotate === 'number' ? { rotate: animation.rotate } : {}),
    powerGroup: typeof data.powerGroup === 'string' ? data.powerGroup : 'self', breakable: data.breakable !== false,
    emissiveNodes: Array.isArray(data.emissiveNodes) ? data.emissiveNodes.filter((n): n is string => typeof n === 'string') : [],
  };
  return { anchor, errors: [...errors, ...validateLight(anchor)] };
}

/** §6 rules that can be checked from the anchor alone (emissive references are checked against the GLB by the tool). */
export function validateLight(a: LightAnchor): string[] {
  const errors: string[] = [], at = a.name;
  if (!lightTypes.includes(a.type)) errors.push(`${at}: unknown type ${a.type}`);
  if (!(a.color in lightPalette)) errors.push(`${at}: color ${a.color} is not a light palette token`);
  if (!(a.intensity >= 0 && a.intensity <= 10)) errors.push(`${at}: intensity ${a.intensity} outside 0..10`);
  if (!(a.range > 0)) errors.push(`${at}: range ${a.range} must be positive`);
  if (!['none', 'soft', 'strong'].includes(a.beam)) errors.push(`${at}: beam ${a.beam}`);
  if (!['none', 'hero'].includes(a.shadow)) errors.push(`${at}: shadow ${a.shadow}`);
  if (!['none', 'fluorescent', 'fire', 'damaged', 'startup'].includes(a.flicker)) errors.push(`${at}: flicker ${a.flicker}`);
  if (a.type === 'spot') {
    if (!(a.angle && a.angle > 0 && a.angle < 180)) errors.push(`${at}: spot angle ${a.angle}`);
    else if (spotGroundDistance(a) > a.range) errors.push(`${at}: spot does not reach the ground within ${a.range} m`);
  }
  return errors;
}

/** Distance along the cone's lowest ray to the asset ground plane (y = 0); Infinity when it never descends. */
export function spotGroundDistance(a: Pick<LightAnchor, 'position' | 'direction' | 'angle'>): number {
  const [dx, dy, dz] = a.direction, length = Math.hypot(dx, dy, dz) || 1;
  const lowest = Math.asin(Math.max(-1, Math.min(1, dy / length))) - (a.angle ?? 0) * Math.PI / 360;
  if (lowest >= 0) return Infinity;
  return Math.max(0, a.position[1]) / Math.sin(-Math.max(-Math.PI / 2, lowest));
}

/** `public/assets/models/veh.sedan-green.glb` → `veh.sedan-green` (the light table key). */
export const glbId = (glb: string): string => glb.slice(glb.lastIndexOf('/') + 1).replace(/\.glb$/, '');
