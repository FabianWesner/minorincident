import { describe, expect, it } from 'vitest';
import { checkpointName, checkpointNames } from '../../../src/data/checkpointNames';

describe('retry checkpoint names', () => {
  it('names every campaign checkpoint so raw ids never reach the retry screen', () => {
    const checkpoints: Record<string, string[]> = {
      L1: ['accident', 'bat'],
      L2: ['axe', 'doors', 'escape', 'cluster'],
      L3: ['armory', 'fallback', 'segment-2', 'segment-2b', 'segment-3', 'segment-3b'],
      L4: ['arrival', 'turn', 'line-1', 'nests', 'armor', 'line-break'],
      L5: ['outside', 'survivor-1', 'survivor-2', 'survivor-3', 'survivor-4', 'survivor-5'],
      L6: ['shelter', 'abandon', 'mid-tunnel', 'exit-platform'],
      L7: ['night-exit', 'rocket', 'corridor'],
      L8: ['sanctuary', 'breach', 'escape-route'],
      L9: ['crossing-start', 'outskirts-approach'],
      L10: ['cure-crash', 'cure-residential', 'cure-industrial', 'cure-military', 'cure-research-entry', 'cure-research', 'cure-corridor', 'cure-complex', 'cure-disperse-ready'],
    };

    for (const [level, ids] of Object.entries(checkpoints)) {
      expect(checkpointNames[level], `${level} checkpoint labels`).toBeDefined();
      for (const id of ['start', ...ids]) {
        const name = checkpointNames[level][id];
        expect(name, `${level} checkpoint ${id}`).toBeTruthy();
        expect(name).not.toBe(id);
        expect(name).not.toContain('—');
      }
    }
  });

  it('uses the PO-facing research lab wording and never exposes an unknown id', () => {
    expect(checkpointName('L10', 'cure-research')).toBe('the research lab');
    expect(checkpointName('L10', 'unknown-id')).toBe('the last checkpoint');
  });
});
