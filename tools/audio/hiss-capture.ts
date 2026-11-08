/** R15 live production graph recorder. Raw multichannel WAVs stay in /tmp.
 * Run through tools/e2e-lock.sh; one headless pooled browser, sequential levels.
 * `before` removes only the R15 guard from the served module to reproduce HEAD.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from '../browser-pool/client';
import { audioCues, ambienceTiers } from '../../src/data/audioCues';

const mode = process.argv[2] ?? 'after';
if (!['before', 'after'].includes(mode)) throw new Error('mode must be before or after');
const levels = process.argv.slice(3).length ? process.argv.slice(3) : ['L1', 'L4', 'L7', 'L10'];
const seconds = Number(process.env.R15_SECONDS ?? 30), port = Number(process.env.R15_PORT ?? 3351);
if (port === 3300) throw new Error('Do not use shared port 3300');
const origin = `http://127.0.0.1:${port}`, out = process.env.R15_RAW ?? '/tmp/r15-hiss-audio';
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/audio-layout.json`, JSON.stringify({ cues: Object.values(audioCues), ambienceTiers }, null, 2));
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: ['ignore', 'ignore', 'pipe'] });
server.stderr.on('data', b => process.stderr.write(b));
let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* server boot */ }
    await new Promise(r => setTimeout(r, 200));
    if (i === 99) throw new Error('Vite did not start');
  }
  browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  page.on('pageerror', error => console.error('pageerror:', error.message));
  await page.route('**/src/audio/AudioGraph.ts*', async route => {
    const response = await route.fetch();
    let body = await response.text();
    const marker = 'this.setListener(this.listener);';
    if (!body.includes(marker)) throw new Error('Graph instrumentation point missing');
    body = body.replace(marker, `${marker} globalThis.__R15_GRAPH = this;`);
    if (mode === 'before') {
      const guard = /if\s*\(\(options\.loop \?\? cue\.loop\) && \(cue\.bus === ["']ambience["'] \|\| cue\.id === ["']vehicle.fire["'] \|\| cue\.id === ["']vehicle.sputter["']\)\)\s*return null;/;
      if (!guard.test(body)) throw new Error('R15 guard missing; baseline must differ only by this guard');
      body = body.replace(guard, '/* R15 baseline: original production loop playback */');
      body = body.replace(/if \(BACKGROUND_NOISE_CUES.has\(cue.id\)\)\s*return null;/, '/* R15 baseline: original scenery puffs */');
    }
    await route.fulfill({ response, body });
  });
  await page.goto(`${origin}/?test=1&renderer=webgl&quality=low&dpr=1&audio=muted&seed=1`);
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  for (const level of levels) {
    console.log(`${mode} ${level}: load`);
    await page.evaluate(async level => {
      const api = window.__SS__!;
      await api.loadLevel(level, { seed: 1 });
      api.missions.begin(); api.cheats.god(true); api.pause();
      await api.audio.unlock(); api.settings.set({ muted: false });
      api.setLoadout(['weapon.handgun'], ['weapon.bat']);
    }, level);
    // Let deferred music/background preparation settle before recording.
    await page.waitForTimeout(1500);
    console.log(`${mode} ${level}: record ${seconds}s`);
    const record = String.raw`async ({ seconds, fire, spawn }) => {
      const api = window.__SS__, graph = globalThis.__R15_GRAPH, ctx = graph.context;
      const { wave } = await import('/src/audio/synthesis.ts');
      graph.output.disconnect(ctx.destination);
      graph.output.gain.value = 1;
      const names = ['master', 'music', 'ambience', 'sfx', 'voice'];
      const nodes = [graph.output, graph.buses.music, graph.buses.ambience, graph.sfx, graph.voice];
      const merger = ctx.createChannelMerger(16), recorder = ctx.createScriptProcessor(2048, 16, 1), mute = ctx.createGain();
      mute.gain.value = 0;
      const taps = nodes.map((node, i) => {
        const split = ctx.createChannelSplitter(2);
        node.connect(split); split.connect(merger, 0, i * 2); split.connect(merger, 1, i * 2 + 1);
        return split;
      });
      merger.connect(recorder); recorder.connect(mute).connect(ctx.destination);
      const chunks = Array.from({length:10}, () => []);
      let frames = 0;
      recorder.onaudioprocess = event => {
        for (let c = 0; c < 10; c++) chunks[c].push(event.inputBuffer.getChannelData(c).slice());
        frames += event.inputBuffer.length;
      };
      const start = { tick: api.tick(), player: api.getEntity(1), audio: api.audio.snapshot() };
      api.audio.clearLog(); api.resume();
      const t0 = performance.now(); let enemies = false; const reduction = [];
      while (performance.now() - t0 < seconds * 1000) {
        const t = (performance.now() - t0) / 1000; reduction.push(graph.compressor.reduction);
        const walking = t >= 5 && t < 14, combat = t >= 16 && t < 25;
        if (combat && !enemies) {
          enemies = true;
          const p = api.getEntity(1).transform;
          for (let i = 0; i < (spawn ? 3 : 0); i++) api.spawn('infected.runner', {x:p.x + 6 + i * 1.5, z:p.z});
        }
        api.input.set({move:{x:walking ? (t < 9 ? .6 : -.6) : 0,z:0}, walk:true, aim:{x:1,z:0}, aimSource:'keyboard', activeAttack:combat, left:{down:combat && fire,held:combat && fire,up:false}});
        await new Promise(r => setTimeout(r, 50));
      }
      api.input.clear(); api.pause();
      recorder.onaudioprocess = null;
      const end = {tick:api.tick(),player:api.getEntity(1),audio:api.audio.snapshot(),emitters:api.audio.emitters()};
      if (fire && !end.audio.cues.some(c => c.cue.startsWith('action.weapon.'))) throw new Error('Combat audio missing from L10 capture');
      const data = chunks.map(parts => {
        const samples = new Float32Array(frames); let offset=0;
        for (const part of parts) {samples.set(part,offset);offset+=part.length;}
        return samples;
      });
      const bytes = wave(data, ctx.sampleRate);
      let binary = '';
      for(let i=0;i<bytes.length;i+=16384) binary += String.fromCharCode(...bytes.subarray(i,i+16384));
      for(let i=0;i<nodes.length;i++){nodes[i].disconnect(taps[i]);taps[i].disconnect();}
      merger.disconnect();recorder.disconnect();mute.disconnect();graph.output.gain.value=0;graph.output.connect(ctx.destination);
      return {wav:btoa(binary),names,sampleRate:ctx.sampleRate,frames,start,end,compressorReduction:reduction};
    }`;
    const result = await page.evaluate(`(${record})(${JSON.stringify({ seconds, fire: level === 'L10', spawn: level === 'L1' || level === 'L4' })})`) as { wav: string; [key: string]: unknown };
    const { wav, ...metadata } = result;
    writeFileSync(`${out}/${mode}-${level}.wav`, Buffer.from(wav, 'base64'));
    writeFileSync(`${out}/${mode}-${level}.json`, JSON.stringify(metadata, null, 2));
    console.log(`${mode} ${level}: wrote ${Buffer.byteLength(wav, 'base64')} bytes`);
  }
  await context.close();
} finally { await browser?.close(); server.kill(); }
