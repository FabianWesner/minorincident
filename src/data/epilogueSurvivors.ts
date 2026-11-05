import { l5Survivors } from './l5';

/** Named lines for the ending credits, from the saved L8 escape roster (story audit finding 4/10). Empty when L8 left no roster. */
export function epilogueSurvivorLines(escapedKeys: readonly string[] | undefined): string[] {
  if (!escapedKeys) return [];
  const safe = l5Survivors.filter(s => escapedKeys.includes(s.key)).map(s => s.name);
  const lost = l5Survivors.filter(s => !escapedKeys.includes(s.key)).map(s => s.name);
  const lines: string[] = [];
  if (safe.length) lines.push(`${safe.join(', ')}: safe at the evacuation point, waiting for the cure.`);
  if (lost.length) lines.push(`Remembered: ${lost.join(', ')}.`);
  return lines;
}
