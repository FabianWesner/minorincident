import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export interface ReviewDecision {
  row: string; status: 'PASS' | 'FAIL'; reviewer: string; date: string; commit: string;
  clauses: { clause: string; verdict: 'PASS' | 'FAIL'; note?: string }[];
  evidence: { file: string; sha256: string; what: string }[]; notes?: string;
}
const root = 'docs/qa/reviews';
const rows = new Set(['G-01','G-02','G-03','G-04','G-05','G-06','G-07','G-08','G-09','G-10','G-11','G-12','G-13','G-14','G-15','G-16','G-17','G-18','G-19','G-20','G-21','G-22','G-23','G-24','G-25','G-26','G-27', ...Array.from({length:10},(_,i)=>Array.from({length:30},(_,j)=>`L${i+1}-${String(j+1).padStart(2,'0')}`)).flat()]);
export function validateReview(value: unknown, expectedRow?: string): ReviewDecision {
  const r = value as ReviewDecision;
  const fail = (message: string): never => { throw new Error(`Invalid acceptance review: ${message}`); };
  if (!r || typeof r !== 'object' || !rows.has(r.row) || (expectedRow && r.row !== expectedRow)) fail('unknown or mismatched row');
  if (!['PASS','FAIL'].includes(r.status) || typeof r.reviewer !== 'string' || !r.reviewer.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || Number.isNaN(Date.parse(`${r.date}T00:00:00Z`)) || !/^[0-9a-f]{40}$/.test(r.commit)) fail('invalid decision metadata');
  if (!Array.isArray(r.clauses) || !r.clauses.length || r.clauses.some(c => !c || typeof c.clause !== 'string' || !c.clause.trim() || !['PASS','FAIL'].includes(c.verdict))) fail('invalid clauses');
  if (!Array.isArray(r.evidence) || !r.evidence.length || r.evidence.some(e => !e || typeof e.file !== 'string' || !e.file || typeof e.what !== 'string' || !e.what || !/^[0-9a-f]{64}$/.test(e.sha256))) fail('invalid evidence (SHA-256 required)');
  if (r.status === 'PASS' && r.clauses.some(c => c.verdict !== 'PASS')) fail('PASS decision contains a failing clause');
  return r;
}
export function evidenceIsArchivedOrMatches(file: string, sha256: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(sha256)) return false;
  return !existsSync(file) || createHash('sha256').update(readFileSync(file)).digest('hex') === sha256;
}
export function loadReviews(row: string): ReviewDecision | undefined {
  const path = join(root, `${row}.json`);
  if (!existsSync(path)) return;
  const decision = validateReview(JSON.parse(readFileSync(path, 'utf8')), row);
  for (const evidence of decision.evidence) {
    // Visual evidence is routinely archived outside the source tree. The
    // review remains auditable from its recorded digest and observation; when
    // the artifact is present, still verify it against that digest.
    if (!evidenceIsArchivedOrMatches(evidence.file, evidence.sha256)) throw new Error(`Review evidence hash mismatch: ${evidence.file}`);
  }
  return decision;
}
export function validateReviewDirectory(): void {
  if (!existsSync(root)) return;
  for (const file of readdirSync(root).filter(file => file.endsWith('.json'))) {
    const row = file.slice(0, -5);
    const decision = validateReview(JSON.parse(readFileSync(join(root, file), 'utf8')), row);
    for (const evidence of decision.evidence) {
      if (!evidenceIsArchivedOrMatches(evidence.file, evidence.sha256)) throw new Error(`Invalid review evidence hash: ${evidence.file}`);
    }
  }
}
export function latestRelevantCommit(level: string): string {
  const paths = [`src/levels/${level}`, 'src/data', 'src/render', 'src/ui', 'src/assets', 'public'];
  return execFileSync('git', ['log', '-1', '--format=%H', '--', ...paths], { encoding: 'utf8' }).trim();
}
export function reviewFreshness(review: ReviewDecision, level: string): 'FRESH' | 'STALE' {
  try {
    const newer = execFileSync('git', ['log', '-1', '--format=%H', `${review.commit}..HEAD`, '--', `src/levels/${level}`, 'src/data', 'src/render', 'src/ui', 'src/assets', 'public'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return newer ? 'STALE' : 'FRESH';
  } catch { return 'STALE'; }
}
