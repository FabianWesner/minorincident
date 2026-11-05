import { readFileSync } from 'node:fs';

/** Derive milestone membership from the epic map; exact tags never match E010. */
export function selectionFor(target: string): { epics: string[]; pattern: string } {
  let epics: string[];
  if (/^E\d{2}$/.test(target)) {
    const status = JSON.parse(readFileSync('specs/status.json', 'utf8'));
    if (!(target in status)) throw new Error(`Unknown epic: ${target}`);
    epics = [target];
  } else if (/^M[0-4]$/.test(target)) {
    epics = readFileSync('specs/04-epics-overview.md', 'utf8').split('\n').flatMap((line) => {
      const columns = line.split('|').map((column) => column.trim());
      const id = columns[1]?.match(/\[(E\d{2})\]/)?.[1];
      return id && columns[3]?.includes(target) ? [id] : [];
    });
    if (!epics.length) throw new Error(`No epics for milestone: ${target}`);
  } else throw new Error('Usage: npm run verify -- E<NN> or M<N>');
  return { epics, pattern: `@(?:${epics.join('|')})(?:-AC\\d+)?(?=\\s|$)|@smoke(?=\\s|$)` };
}
