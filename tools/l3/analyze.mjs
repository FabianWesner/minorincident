// Summarise L3 battery JSONs (test-results/epics/E21/bots-*.json) against the E21 criteria: node tools/l3/analyze.mjs [file...]
import { readdirSync, readFileSync } from 'node:fs';
const dir = 'test-results/epics/E21';
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter(f => f.startsWith('bots-')).map(f => `${dir}/${f}`);
const med = v => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
for (const file of files) {
  const runs = JSON.parse(readFileSync(file, 'utf8'));
  const done = runs.filter(r => r.outcome === 'complete');
  const out = { file: file.split('/').pop(), runs: runs.length, complete: done.length, medianS: med(done.map(r => r.simSeconds)), times: runs.map(r => Math.round(r.simSeconds)).join(','), deaths: med(runs.map(r => r.deaths)), dmg: med(runs.map(r => Math.round(r.damage))), maxDeaths: Math.max(...runs.map(r => r.deaths)) };
  const sq = runs.filter(r => r.squad);
  if (sq.length) {
    const s1o = sq.reduce((a, r) => a + r.s1.officerKills, 0), s1p = sq.reduce((a, r) => a + r.s1.playerKills, 0);
    Object.assign(out, {
      s1OfficerShare: +(s1o / Math.max(1, s1o + s1p)).toFixed(2), s1Damage: med(sq.map(r => r.s1.damage)), near8: med(sq.map(r => r.squad.near8Share)), maxJump: Math.max(...sq.map(r => r.squad.maxJumpM)),
      ends: [0, 1, 2].map(k => med(sq.map(r => r.squad.segmentEnds[k]))), atCheckpoint: med(sq.map(r => r.squad.atCheckpoint)), all4: sq.filter(r => r.squad.atCheckpoint === 4).length, corridorTurn: sq.filter(r => r.squad.turnedInCorridor >= 1).length,
      chk: sq.map(r => r.squad.atCheckpoint).join(','), atFallback: sq.map(r => r.squad.atFallback).join(''),
    });
  }
  Object.assign(out, {
    regression: Math.max(...runs.map(r => r.regressionM)), streets: [...new Set(runs.flatMap(r => r.streets))].join('/'),
    prepop: runs[0]?.density.prepopulated, near30: [0, 1, 2].map(k => med(runs.map(r => r.density.near30[k]))), maxConc: Math.max(...runs.map(r => r.density.maxConcurrent)), cap: runs[0]?.density.cap,
    medkits: med(runs.map(r => r.medkits)), lowHp: med(runs.map(r => r.lowHpShare)),
    gunMed: med(runs.flatMap(r => r.killDistances.gun)), meleeMed: med(runs.flatMap(r => r.killDistances.melee)),
    officerTurnDuring: runs.filter(r => r.attack?.turnedDuring >= 1).length, fallback: runs.map(r => r.attack?.fallbackCause?.[0] ?? '-').join(''),
    audit: runs.reduce((a, r) => [a[0] + r.audit.sightViolations, a[1] + r.audit.nonSightAlerts, a[2] + r.audit.emergeSeen], [0, 0, 0]),
  });
  console.log(JSON.stringify(out));
}
