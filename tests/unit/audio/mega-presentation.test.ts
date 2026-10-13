import { MusicDirector } from '../../../src/audio/MusicDirector';
import { scoreFile } from '../../../src/audio/StreamedMusic';
import { AudioRegistry } from '../../../src/audio/AudioRegistry';
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { megaBands, megaCueInterval, cureRecordingText, isMega } from '../../../src/data/megaPresentation';
import { audioCues, megaAudioCues, megaCueRates } from '../../../src/data/audioCues';

test('T-E32-13-audio @E32-AC13 bands increase the same recorded cue by at least 6 dB per band', () => {
  const gains = Object.values(megaBands).map(b => b.gain);
  for (let i = 1; i < gains.length; i++) expect(20 * Math.log10(gains[i] / gains[i - 1])).toBeGreaterThanOrEqual(6);
  for (const id of ['mega.roar', 'mega.impact', 'mega.step', 'mega.charge', 'mega.slam', 'mega.grab']) {
    expect(megaAudioCues[id].bus).toBe('telegraph'); expect(megaAudioCues[id].caption).toContain('Mega Alpha'); expect(megaCueRates[id]).toBeLessThan(1);
  }
  expect(megaAudioCues['mega.charge'].priority).toBeGreaterThan(megaAudioCues['mega.roar'].priority);
  const intervals = Array.from({ length: 100 }, (_, i) => megaCueInterval(10, i));
  expect(Math.min(...intervals)).toBeGreaterThanOrEqual(1200); expect(Math.max(...intervals)).toBeLessThanOrEqual(2100);
  expect(new Set(intervals).size).toBeGreaterThan(50);
});

test('T-E32-14-ring @E32-AC14 ring exposes only a band, centered on the player; HUD excludes Mega pins', () => {
  const ring = readFileSync('src/ui/MegaRing.ts', 'utf8'), hud = readFileSync('src/ui/Hud.ts', 'utf8');
  expect(ring).not.toMatch(/world-x|world-z|sourceId|transform\.x|transform\.z/);
  expect(hud).toContain('if (isMega(entity)) continue;');
  expect(isMega({ archetype: 'infected.alpha', infected: { variant: 'inf.mega-alpha' } } as import('../../../src/sim/world/types').EntitySnapshot)).toBe(true);
  expect(isMega(undefined)).toBe(false);
  for (const b of Object.values(megaBands)) expect(b.label).toMatch(/^Mega Alpha: /);
});

test('T-E32-15-recording @E32-AC15 campus recording reuses an instrumental stock slice and carries all story facts', () => {
  expect(megaAudioCues['cure.recording'].category).toBe(audioCues['music.L6.base'].category);
  expect(megaAudioCues['cure.recording'].offset).toBe(audioCues['music.L6.base'].offset);
  expect(megaAudioCues['cure.recording'].loop).toBe(false);
  expect(megaAudioCues['cure.recording'].bus).toBe('dialogue');
  for (const fact of ['airborne', 'not a vaccine', 'healthy humans and animals', 'immediately kills infected', 'never reverses infection', 'regional dispersal complex']) expect(cureRecordingText).toContain(fact);
});

test('@E32-AC13 finale music reuses licensed L6 recordings, tempo and the existing director transitions', () => {
  const music = new MusicDirector('L10'); expect(music.bar).toBe(new MusicDirector('L6').bar);
  expect(scoreFile('L10','calm')).toBe('calm-L6'); expect(scoreFile('L10','tension')).toBe('tension-L6');
  for (const [minimum, state] of [[.25,'tension'],[.5,'combat']] as const) { music.update(1, {alerted:0,danger:false,minimum}); expect(music.state).toBe(state); }
  music.update(2,{alerted:0,danger:false,complete:true}); expect(music.state).toBe('aftermath');
});

test('@E32-AC13 processed cues retain the original sprite buffer/offset and their own captions/priority', async () => {
  const buffer = {} as AudioBuffer;
  const registry = new AudioRegistry({decodeAudioData:async()=>buffer} as unknown as BaseAudioContext, async()=>new ArrayBuffer(0));
  await registry.load('telegraph');
  const roar=registry.get('mega.roar',0)!; expect(roar.buffer).toBe(buffer);expect(roar.cue.offset).toBe(audioCues['telegraph.brute'].offset);
  expect(roar.cue.caption).toBe('Mega Alpha roaring');expect(roar.cue.id).toBe('mega.roar');
  expect(registry.get('mega.charge',0)!.cue.priority).toBe(150);
  expect(Object.keys(audioCues)).not.toContain('mega.roar');
});
