/* eslint-disable @typescript-eslint/no-explicit-any -- diagnostic (r34-l8qa) */
// Usage: node --import tsx/esm tools/qa/diag/r34-fixture-info.ts <fixture files...> : what a QA fixture contains (checkpoint, arena flags, loadout, boss HP, size).
import { readFileSync } from 'node:fs';
import { readFixture } from '../fixture-io';
for (const file of process.argv.slice(2)) {
  const f: any = readFixture(file), r: any = f.resume?.checkpoint ?? f.resume;
  const st = r?.state?.states ?? {};
  console.log('==', f.label, f.level, 'size', readFileSync(file).length, 'checkpoint', r?.state?.checkpoint ?? '-', 'breached', st.breached, 'arenas', Object.keys(st).filter(k => /^arena-/.test(k) && st[k]).join(',') || 'none');
  const player = r?.entities?.find((e: any) => e.kind === 'player');
  console.log('   weapons', (JSON.stringify(player?.weapons) ?? '-').slice(0, 400));
  console.log('   campaign launcher', /launcher|rocket/i.test(JSON.stringify(f.campaign)), 'resume launcher', /launcher|rocket/i.test(JSON.stringify(r ?? {})));
  for (const e of r?.entities ?? []) if (/lion|elephant|gorilla|zebra|flamingo|monkey/.test(e.archetype ?? '') && e.health && e.health.current > 0) console.log('   entity', e.archetype, 'hp', e.health.current, '/', e.health.max, 'at', e.transform?.x?.toFixed?.(0), e.transform?.z?.toFixed?.(0), 'infected', !!e.infected);
  console.log('   player rack RIGHT', player?.weapons?.RIGHT?.rack?.map((w: any) => w.id).join(','), '| campaign racks', JSON.stringify(f.campaign.racks), '| owned', f.campaign.ownedActions?.join(','));
  const p = player?.transform; if (p) console.log('   player at', JSON.stringify(p).slice(0, 120));
}
