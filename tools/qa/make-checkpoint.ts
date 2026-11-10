// Native generator of REAL player-format saves (the exact string the game writes to localStorage via SaveStore).
// Works at old commits too (used for the r28 save-compat matrix): it only needs preset/SaveStore/runLevel.
//
//   npx tsx tools/qa/make-checkpoint.ts --out <dir> [--what campaign,l9,l10] [--seed 1] [--max-l10 1800] [--qa-parts l8,l9,l10]
//
// campaign: one save per level preset L2..L10-default (the level-select state a player has after finishing the previous level).
// l9:       Level 9 crash records (campaign.l9Crash) captured at ~30 s of driving and when the crawl starts.
// l10:      one save per L10 checkpoint (campaign + cureResume), written like Game.saveCampaign(atCheckpoint=true),
//           plus one "live" save 20 s after each checkpoint (current != checkpoint) to cover both record formats.
// Each output file is `<label>.json.gz` = gzip of the stored string; load with tools/qa/r28-check-saves.ts or
// `decodeSave(gunzip(file))`, or write the string to localStorage['minor-incident.campaign'].
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import * as runner from '../sim-runner/levels';
// Older commits (batch 59) have no stopWhen/LevelRunStopped: the run then simply continues to its end.
const runLevel = async (...a: Parameters<typeof runner.runLevel>) => { try { return await runner.runLevel(...a); } catch (e) { if (String(e).includes('Level run stopped')) return null; throw e; } };
import { preset, type CampaignSave, type ProgressionPreset } from '../../src/sim/progression/Campaign';
import { SaveStore } from '../../src/sim/progression/Save';
import { writeFixture, type QaFixture } from './fixture-io';

const { values } = parseArgs({ options: { out: { type: 'string' }, what: { type: 'string', default: 'campaign,l9,l10' }, seed: { type: 'string', default: '1' }, 'max-l10': { type: 'string', default: '1800' }, 'qa-parts': { type: 'string', default: 'l8,l9,l10' } } });
const qaParts = new Set(String(values['qa-parts']).split(','));
const out = resolve(values.out ?? 'saves-out'); mkdirSync(out, { recursive: true });
const what = new Set(String(values.what).split(','));
const seed = Number(values.seed);

/** The string SaveStore would persist for this save (plain JSON, gzip1 or checkpoint1 record). */
function stored(save: CampaignSave): string {
  let text = '';
  const ok = new SaveStore({ getItem: () => text, setItem: (_k, v) => { text = v; }, removeItem: () => { text = ''; } }).write(save);
  if (!ok) throw new Error('SaveStore.write failed');
  return text;
}
const manifest: { label: string; level: number; completed: number; kind: string; bytes: number; storedChars?: number; tick?: number; checkpoint?: string }[] = [];
function emit(label: string, save: CampaignSave, kind: string, extra: { tick?: number; checkpoint?: string } = {}): void {
  const text = stored(save), bytes = gzipSync(text);
  writeFileSync(`${out}/${label}.json.gz`, bytes);
  manifest.push({ label, level: save.unlockedLevel, completed: save.completedLevels, kind, bytes: bytes.length, storedChars: text.length, ...extra });
  console.log('wrote', label, bytes.length, 'B gz,', text.length, 'chars stored');
}

if (what.has('campaign')) for (let n = 2; n <= 10; n++) emit(`campaign-L${n}-default`, preset(`L${n}-default` as ProgressionPreset), 'campaign');

if (what.has('l9')) {
  const taken = new Set<string>();
  await runLevel('L9', 'complete', seed, 600, 'auto', preset('L9-default'), undefined, 0, {
    beforeBegin: world => {
      const update = world.update.bind(world);
      world.update = () => {
        update();
        const l9 = world.missions?.l9, live = world.progression?.campaign;
        if (!l9 || !live || live.crossingHandover) return;
        const phase = (l9 as unknown as { state?: { phase?: string } }).state?.phase ?? 'driving';
        const key = phase === 'crawl' ? 'crawl' : phase === 'driving' && world.tick >= 1800 ? 'driving' : '';
        if (!key || taken.has(key)) return;
        taken.add(key);
        const save = structuredClone(live) as CampaignSave; save.l9Crash = l9.save();
        emit(`l9-crash-${key}`, save, 'l9Crash', { tick: world.tick });
      };
    },
    stopWhen: () => taken.has('crawl'),
  });
}

if (what.has('l10')) {
  const seen = new Set<string>(); let pendingLive: { id: string; at: number } | null = null; let n = 0;
  await runLevel('L10', 'complete', seed, Number(values['max-l10']), 'auto', preset('L10-default'), undefined, 0, {
    beforeBegin: world => {
      world.events.on('checkpoint.set', e => {
        if (e.type !== 'checkpoint.set' || seen.has(e.id) || !world.missions || !world.progression?.campaign) return;
        seen.add(e.id); n++;
        const save = structuredClone(world.progression.campaign) as CampaignSave;
        save.cureResume = { ...world.missions.saveResume(true), cameraZoom: 1 } as CampaignSave['cureResume'];
        emit(`l10-${String(n).padStart(2, '0')}-${e.id}`, save, 'cureResume', { tick: world.tick, checkpoint: e.id });
        pendingLive = { id: e.id, at: world.tick + 1200 };
      });
      const update = world.update.bind(world);
      world.update = () => {
        update();
        if (!pendingLive || world.tick < pendingLive.at || !world.missions || !world.progression?.campaign) return;
        const { id } = pendingLive; pendingLive = null;
        const save = structuredClone(world.progression.campaign) as CampaignSave;
        save.cureResume = { ...world.missions.saveResume(false), cameraZoom: 1 } as CampaignSave['cureResume'];
        try { emit(`l10-${String(n).padStart(2, '0')}-${id}-live`, save, 'cureResume-live', { tick: world.tick, checkpoint: id }); } catch (err) { console.log('live save skipped', id, String(err)); }
      };
    },
  });
}
// qa: HEAD-only QA fixtures (see tests/fixtures/saves/README.md). Plain-JSON fixtures `{kind,label,level,description,campaign,resume?}`.
//   kind 'campaign-save'   : load with campaign.restore(campaign)+save() then Continue (L9 crash record, L10 cureResume).
//   kind 'mission-resume'  : __SS__.loadLevel(level,{progression,resume}) (L8 arena snapshots; L8 has no persisted mid-level save).
if (what.has('qa')) {
  const { l8BossArenas } = await import('../../src/data/l8Bosses');
  const fixture = (label: string, kind: string, level: string, description: string, campaign: CampaignSave, resume?: unknown, extra: object = {}): void => {
    const { path, bytes } = writeFixture(out, { kind, label, level, description, ...extra, campaign, ...(resume ? { resume } : {}) } as QaFixture);
    manifest.push({ label, level: campaign.unlockedLevel, completed: campaign.completedLevels, kind, bytes });
    console.log('fixture', path, bytes, 'B');
  };
  // L8: 30 m before each arena entry (not yet engaged) + the engaged elephant checkpoint (APC yard).
  if (qaParts.has('l8')) {
    const wanted = new Set(['lion', 'gorilla', 'elephant']), done = new Set<string>(), engaged = new Set<string>();
    await runLevel('L8', 'complete', seed, 1800, 'auto', preset('L8-default'), undefined, 0, {
      beforeBegin: world => {
        world.events.on('checkpoint.set', e => {
          if (e.type !== 'checkpoint.set') return;
          engaged.add(e.id);
          if (e.id === 'arena-elephant' && !done.has('elephant-engaged')) {
            done.add('elephant-engaged');
            fixture('l8-elephant-apc-yard-engaged', 'mission-resume', 'L8', 'Elephant arena just engaged: the old elephant breaks into the vehicle yard; APC and survivors present.', structuredClone(world.progression!.campaign!) as CampaignSave, world.missions!.saveResume(true), { progression: 'L8-default', checkpoint: e.id });
          }
        });
        const update = world.update.bind(world);
        world.update = () => {
          update();
          const p = world.entities.get(1);
          if (!p || !world.missions || !world.progression?.campaign) return;
          for (const a of l8BossArenas) {
            if (!wanted.has(a.id) || done.has(a.id) || engaged.has(`arena-${a.id}`)) continue;
            if (Math.hypot(p.transform.x - a.entry.x, p.transform.z - a.entry.z) > 30) continue;
            done.add(a.id);
            fixture(`l8-before-${a.id}`, 'mission-resume', 'L8', `Player within 30 m of the ${a.id} arena entry, arena not yet engaged.`, structuredClone(world.progression.campaign) as CampaignSave, world.missions.saveResume(false), { progression: 'L8-default', arena: a.id });
          }
        };
      },
      stopWhen: () => done.size >= 4,
    });
    console.log('L8 captured', [...done].join(','));
  }
  // L9: persisted crash records (the real save format) shortly before the rail stall and at the bridge checkpoint.
  if (qaParts.has('l9')) {
    const done = new Set<string>(); let last: { save: CampaignSave; tick: number } | null = null;
    await runLevel('L9', 'complete', seed, 900, 'auto', preset('L9-default'), undefined, 0, {
      beforeBegin: world => {
        const update = world.update.bind(world);
        world.update = () => {
          update();
          const l9 = world.missions?.l9, live = world.progression?.campaign, drv = l9?.state.driving;
          if (!l9 || !live || !drv || live.crossingHandover || l9.state.phase !== 'driving') return;
          const snap = (): CampaignSave => { const s = structuredClone(live) as CampaignSave; s.l9Crash = l9.save(); return s; };
          // railX is 380 (src/data/l9.ts): record once ~60 m before the stall so QA sees the approach, not the stall itself.
          if (drv.stallAt === null && !last && (world.entities.get(l9.state.carId)?.transform.x ?? 0) >= 320) last = { save: snap(), tick: world.tick };
          if (drv.stallAt !== null && last && !done.has('rail')) {
            done.add('rail');
            fixture('l9-before-rail-stall', 'campaign-save', 'L9', 'Driving APC ~60 m (x>=320) before the rail crossing at x=380 where the APC stalls.', last.save, undefined, { tick: last.tick });
          }
          // r33-l9polish: wait for a pose with 8 m of clear lane east of the APC (the bot may park beside the sandbag rows right after the bay).
          if (drv.checkpoints.includes('bridge') && !done.has('bridge') && l9.driving.laneClear(8, 0, false)) {
            done.add('bridge');
            fixture('l9-at-bridge', 'campaign-save', 'L9', 'Bridge checkpoint reached (evacuation done), APC at the bridge.', snap(), undefined, { tick: world.tick });
          }
        };
      },
      stopWhen: () => done.has('bridge'),
    });
    console.log('L9 captured', [...done].join(','));
  }
  // L10: cure installed, at the dispersal console (checkpoint cure-disperse-ready), real checkpoint1-format save.
  if (qaParts.has('l10')) {
    let taken = false;
    await runLevel('L10', 'complete', seed, Number(values['max-l10']), 'auto', preset('L10-default'), undefined, 0, {
      beforeBegin: world => {
        world.events.on('checkpoint.set', e => {
          if (e.type !== 'checkpoint.set' || e.id !== 'cure-disperse-ready' || taken || !world.missions || !world.progression?.campaign) return;
          taken = true;
          const save = structuredClone(world.progression.campaign) as CampaignSave;
          save.cureResume = { ...world.missions.saveResume(true), cameraZoom: 1 } as CampaignSave['cureResume'];
          fixture('l10-dispersal-console', 'campaign-save', 'L10', `Checkpoint ${e.id}: cure installed (states cure-installed=${world.missions.state.states['cure-installed']}), at the dispersal console.`, save, undefined, { tick: world.tick });
        });
      },
      stopWhen: () => taken,
    });
    console.log('L10 captured', taken);
  }
}
writeFileSync(`${out}/manifest.json`, JSON.stringify({ commit: process.env.SAVE_COMMIT ?? 'unknown', files: manifest }, null, 1));
console.log('done', manifest.length, 'saves');
