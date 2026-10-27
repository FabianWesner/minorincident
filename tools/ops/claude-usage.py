#!/usr/bin/env python3
"""Claude usage from local Claude Code transcripts (~/.claude/projects/**/*.jsonl).
Sums tokens per model for the current 5-hour window (from the first request after the last
>=5 h gap) and the last 7 days. Weighted = input + output + cache writes + cache reads/10,
a rough proxy for what the plan limits count; the absolute cap is not published, so compare
against the window that hit the cap (see --calibrate). Usage: claude-usage.py [--hours N]"""
import json, glob, os, sys, datetime as dt
from collections import defaultdict
root = os.path.expanduser('~/.claude/projects')
now = dt.datetime.now(dt.timezone.utc)
rows, seen = [], set()
for f in glob.glob(root + '/**/*.jsonl', recursive=True):
    if os.path.getmtime(f) < now.timestamp() - 8 * 86400: continue
    for line in open(f, errors='ignore'):
        if '"usage"' not in line: continue
        try: d = json.loads(line)
        except Exception: continue
        m = d.get('message') or {}
        u = m.get('usage'); ts = d.get('timestamp')
        if not u or not ts: continue
        key = (m.get('id'), d.get('requestId'))
        if key in seen: continue
        seen.add(key)
        t = dt.datetime.fromisoformat(ts.replace('Z', '+00:00'))
        w = u.get('input_tokens', 0) + u.get('output_tokens', 0) + u.get('cache_creation_input_tokens', 0) + u.get('cache_read_input_tokens', 0) / 10
        rows.append((t, m.get('model', '?'), w, u.get('output_tokens', 0), 'subagents' in f))
rows.sort()
# 5 h block: starts at the first request after a gap >= 5 h, or 5 h after the previous block start
start = None
for t, *_ in rows:
    if start is None or t >= start + dt.timedelta(hours=5): start = t.replace(minute=0, second=0, microsecond=0)
def summary(since, label):
    by = defaultdict(lambda: [0.0, 0, 0, 0])
    for t, model, w, out, sub in rows:
        if t >= since:
            b = by[model]; b[0] += w; b[1] += out; b[2] += 1; b[3] += sub
    tot = sum(v[0] for v in by.values())
    print(f'{label}: weighted {tot/1e6:.1f}M')
    for model, (w, out, n, sub) in sorted(by.items(), key=lambda x: -x[1][0]):
        print(f'  {model:24s} {w/1e6:7.1f}M  out {out/1e6:5.2f}M  requests {n:5d} (subagents {sub})')
    return tot
if start:
    left = start + dt.timedelta(hours=5) - now
    print(f'5h window since {start.astimezone():%H:%M}, resets in {max(left.total_seconds(),0)/60:.0f} min')
    summary(start, 'this 5h window')
hours = float(sys.argv[sys.argv.index('--hours') + 1]) if '--hours' in sys.argv else None
if hours: summary(now - dt.timedelta(hours=hours), f'last {hours:g} h')
summary(now - dt.timedelta(days=7), 'last 7 days')
