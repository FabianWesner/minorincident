import { appearanceSample } from './crowdAppearance';
/** Palette assets share one quadruped rig. Appearance never consumes the combat RNG. */
export const dogCoats = ['', 'black', 'cream'] as const;
export function dogModel(seed: number, id: number, infected: boolean): string {
  const coat = dogCoats[appearanceSample(id, seed) % dogCoats.length];
  return `${infected ? 'inf' : 'amb'}.dog${coat ? `.${coat}` : ''}`;
}
export function dogCoat(model: string): string | undefined {
  return /^(inf|amb)\.dog\.(black|cream)$/.exec(model)?.[2];
}
