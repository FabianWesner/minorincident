#!/usr/bin/env python3
"""Measure four real test:gate runs: three remote-only, then three remote + Mac.
Run in an orchestrator-scheduled idle window, after tests-cleanup has supplied
its gate/nightly tags. Never creates runners, bypasses admission, or uses browsers.
python3 tools/remote/benchmark.py <worktree> before|after <evidence-directory>
"""
import concurrent.futures
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import signal
import threading
import sys
import time

HERE = Path(__file__).resolve().parent


def receipt_overlap(jobs):
    """Overlap of actual test execution envelopes, excluding sync/pull/cleanup."""
    if sorted(j.get('backend', '') or '' for j in jobs) != ['local', 'remote', 'remote', 'remote']:
        return 0
    if any('executionMs' not in j for j in jobs): return 0
    return max(0, min(j['executionMs'][1] for j in jobs) - max(j['executionMs'][0] for j in jobs)) / 1000


def main():
    if len(sys.argv) != 4 or sys.argv[2] not in ('before', 'after'):
        raise SystemExit(__doc__)
    wt = Path(sys.argv[1]).resolve()
    phase = sys.argv[2]
    out = Path(sys.argv[3]).resolve() / phase
    out.mkdir(parents=True, exist_ok=False)
    package = (wt / 'package.json').read_bytes()
    if 'test:gate' not in json.loads(package)['scripts']: raise SystemExit('test:gate script missing')
    env = dict(os.environ, RUNNER_SLOTS='1', MI_LOCAL_FALLBACK='0' if phase == 'before' else '1')
    events = []
    children, child_lock, cancelled = {}, threading.Lock(), threading.Event()
    def stop(_sig, _frame):
        cancelled.set()
        with child_lock:
            for process in children.values():
                if process.poll() is None:
                    try: process.terminate()
                    except ProcessLookupError: pass
    for sig in (signal.SIGINT, signal.SIGTERM): signal.signal(sig, stop)
    started = time.time()

    def job(index):
        relative = f'test-results/mac-runner-benchmark/{phase}-{index}.json'
        command = ['sh', str(HERE / 'run.sh'), str(wt), '--pull', relative, '--',
                   'npm', 'run', 'test:gate', '--', '--reporter=default', '--reporter=json', f'--outputFile={relative}']
        at = time.time()
        if cancelled.is_set(): return {'job': index, 'cancelled': True}
        p = subprocess.Popen(command, env=dict(env, MI_LANE=f'benchmark-{phase}-{index}'), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        with child_lock:
            children[index] = p
            if cancelled.is_set(): p.terminate()
        backend = None
        with (out / f'{index}.log').open('w') as log:
            for line in p.stdout:
                now = time.time()
                log.write(line); log.flush()
                if '[runner] slot ' in line and 'acquired' in line: backend = 'remote'
                elif '[local] first file started' in line: backend = 'local'
                else: continue
                events.append({'at': now, 'job': index, 'backend': backend, 'event': 'admitted'})
        rc = p.wait()
        p.stdout.close()
        with child_lock: children.pop(index, None)
        ended = time.time()
        events.append({'at': ended, 'job': index, 'backend': backend, 'event': 'ended'})
        result = {'job': index, 'backend': backend, 'exitCode': rc, 'elapsedS': ended-at, 'command': command}
        receipt = wt / relative
        if receipt.exists():
            result['resultSha256'] = hashlib.sha256(receipt.read_bytes()).hexdigest()
            report = json.loads(receipt.read_text())
            result['tests'] = {k: report.get(k) for k in ('numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTotalTestSuites')}
            files = [f for f in report.get('testResults', []) if f.get('endTime', 0) > f.get('startTime', 0)]
            if files: result['executionMs'] = [min(f['startTime'] for f in files), max(f['endTime'] for f in files)]
            (out / f'{index}.json').write_bytes(receipt.read_bytes())
        return result

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        jobs = list(executor.map(job, range(1, 5)))
    running, proof = {}, False
    for event in sorted(events, key=lambda e: e['at']):
        if event['event'] == 'admitted': running[event['job']] = event['backend']
        else: running.pop(event['job'], None)
        if list(running.values()).count('remote') == 3 and list(running.values()).count('local') == 1: proof = True
    overlap = receipt_overlap(jobs)
    summary = {'phase': phase, 'startedAt': datetime.datetime.fromtimestamp(started, datetime.timezone.utc).isoformat(),
               'wallS': time.time()-started, 'threeRemoteOneLocalOverlap': proof and overlap > 0,
               'receiptOverlapS': overlap, 'cancelled': cancelled.is_set(),
               'worktree': str(wt), 'revision': subprocess.check_output(['git', '-C', str(wt), 'rev-parse', 'HEAD'], text=True).strip(),
               'packageSha256': hashlib.sha256(package).hexdigest(), 'jobs': jobs, 'events': sorted(events, key=lambda e: e['at'])}
    (out / 'summary.json').write_text(json.dumps(summary, indent=2)+'\n')
    print(json.dumps(summary, indent=2))
    if cancelled.is_set(): raise SystemExit(130)
    if any(job.get('exitCode') != 0 for job in jobs): raise SystemExit('One or more gate runs failed; retain receipts, do not treat this attempt as passing')
    if phase == 'after' and not (proof and overlap > 0): raise SystemExit('Measured run did not prove the required concurrency; retain it as an unsuccessful attempt')


if __name__ == '__main__': main()
