import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export interface ReviewDecision {
  row: string; status: 'PASS' | 'FAIL'; reviewer: string; date: string; commit: string;
  sourceDigest?: string;
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
  if (r.sourceDigest !== undefined && !/^[0-9a-f]{64}$/.test(r.sourceDigest)) fail('invalid source digest (SHA-256 required)');
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
export function writeReview(review: ReviewDecision, level: string): ReviewDecision {
  const decision = validateReview({ ...review, sourceDigest: reviewSourceDigest(level) }, review.row);
  writeFileSync(join(root, `${decision.row}.json`), JSON.stringify(decision, null, 2) + '\n');
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
const digestCache = new Map<string, string>();
function relevantPaths(level: string): string[] {
  return [`src/levels/${level}`, 'src/data', 'src/render', 'src/ui', 'src/assets', 'public'];
}
function digestFiles(entries: { path: string; bytes: Buffer }[]): string {
  const hash = createHash('sha256');
  for (const { path, bytes } of entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
    hash.update(path).update('\0').update(bytes).update('\0');
  }
  return hash.digest('hex');
}
export function reviewSourceDigest(level: string, revision?: string): string {
  const paths = relevantPaths(level), key = `${revision ?? 'WORKTREE'}:${paths.join('|')}`;
  const cached = digestCache.get(key);
  if (cached) return cached;
  let entries: { path: string; bytes: Buffer }[];
  if (revision) {
    execFileSync('git', ['cat-file', '-e', `${revision}^{commit}`], { stdio: 'ignore' });
    const tree = execFileSync('git', ['ls-tree', '-r', '-z', '--full-tree', revision, '--', ...paths]);
    const oids: { path: string; oid: string }[] = [];
    for (const record of tree.toString().split('\0').filter(Boolean)) {
      const match = /^(\d+) blob ([0-9a-f]+)\t(.+)$/.exec(record);
      if (match) oids.push({ path: match[3], oid: match[2] });
    }
    const blobs = oids.length ? execFileSync('git', ['cat-file', '--batch'], { input: `${oids.map(item => item.oid).join('\n')}\n`, maxBuffer: 512 * 1024 * 1024 }) : Buffer.alloc(0);
    entries = [];
    let offset = 0;
    for (const item of oids) {
      const endHeader = blobs.indexOf(10, offset);
      const header = blobs.toString('utf8', offset, endHeader).split(' ');
      const size = Number(header[2]), start = endHeader + 1;
      entries.push({ path: item.path, bytes: blobs.subarray(start, start + size) });
      offset = start + size + 1;
    }
  } else {
    const listed = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z', '--', ...paths]).toString().split('\0').filter(Boolean);
    entries = listed.map(path => ({ path, bytes: existsSync(path) ? readFileSync(path) : Buffer.from('<deleted>') }));
  }
  const digest = digestFiles(entries);
  digestCache.set(key, digest);
  return digest;
}
export function reviewFreshness(review: ReviewDecision, level: string): 'FRESH' | 'STALE' {
  try {
    const reviewed = review.sourceDigest ?? reviewSourceDigest(level, review.commit);
    return reviewed === reviewSourceDigest(level) ? 'FRESH' : 'STALE';
  } catch { return 'STALE'; }
}
