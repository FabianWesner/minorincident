/** R15 PCM check and source inventory. Run through tools/e2e-lock.sh. */
import { writeFileSync } from 'node:fs';
import { AudioGraph } from '../../src/audio/AudioGraph';
import { audioCues } from '../../src/data/audioCues';
import imports from '../../assets/audio/imports.json';
import { SceneSession, stopServer } from '../scenelab/session';

const out = 'docs/reports/r15-hiss';
const rows = Object.values(audioCues).filter(c => c.loop || ['noise', 'bed', 'chatter', 'buzz', 'fanfare'].includes(c.shape)).map(cue => {
  let admitted = false;
  const probe = { limiter: { canAdd: () => { admitted = true; return false; } } } as unknown as AudioGraph;
  AudioGraph.prototype.play.call(probe, cue, {} as AudioBuffer);
  return { id: cue.id, category: cue.category, offset: cue.offset, duration: cue.duration, bus: cue.bus, shape: cue.shape, loop: cue.loop,
    source: (imports.cues as Record<string, unknown>)[cue.id] ?? 'procedural', disposition: admitted ? 'retained event effect or music' : 'silenced background noise' };
});
writeFileSync(`${out}/cue-source-audit.json`, JSON.stringify(rows, null, 2) + '\n');
const blocked = rows.filter(row => row.disposition === 'silenced background noise').map(row => row.id);
const session = new SceneSession({ tier: 'low', viewport: { width: 800, height: 600 } });
try {
  await session.open();
  const code = String.raw`async blocked => {
    const { AudioGraph } = await import('/src/audio/AudioGraph.ts');
    const { AudioRegistry } = await import('/src/audio/AudioRegistry.ts');
    const { audioCues } = await import('/src/data/audioCues.ts');
    const context = new OfflineAudioContext(2, 96000, 48000), graph = new AudioGraph(context), registry = new AudioRegistry(context);
    const positive = ['action.weapon.handgun', 'telegraph.runner', 'weather.thunder', 'weapon.minigun-whir', 'vehicle.engine-low'];
    const categories = new Set([...blocked, ...positive].map(id => audioCues[id].category));
    await Promise.all([...categories].map(category => registry.load(category)));
    const unexpected = [];
    for (const id of blocked) if (graph.play(audioCues[id],registry.buffers.get(audioCues[id].category))) unexpected.push(id);
    const pcm = await context.startRendering();
    const peak = Math.max(...Array.from(pcm.getChannelData(0),Math.abs)), active = graph.active.size;
    graph.dispose();
    const eventsContext = new OfflineAudioContext(2,96000,48000), eventsGraph = new AudioGraph(eventsContext);
    const accepted = positive.filter((id,i) => eventsGraph.play(audioCues[id],registry.buffers.get(audioCues[id].category),{time:i*.15}));
    const eventsPcm = await eventsContext.startRendering();
    const eventPeak = Math.max(...Array.from(eventsPcm.getChannelData(0),Math.abs));
    eventsGraph.dispose();
    return {sampleRate:48000,blocked,unexpected,blockedOutputPeak:peak,activeBlockedVoices:active,positive,accepted,eventOutputPeak:eventPeak,registryErrors:registry.errors};
  }`;
  const result = await session.page.evaluate(`(${code})(${JSON.stringify(blocked)})`) as { unexpected: string[]; blockedOutputPeak: number; activeBlockedVoices: number; positive: string[]; accepted: string[]; eventOutputPeak: number };
  writeFileSync(`${out}/graph-check.json`, JSON.stringify(result, null, 2) + '\n');
  if (result.unexpected.length || result.blockedOutputPeak !== 0 || result.activeBlockedVoices || result.accepted.length !== result.positive.length || result.eventOutputPeak === 0)
    throw new Error('Audio graph check failed');
  console.log(JSON.stringify(result));
} finally { await session.close(); stopServer(); }
