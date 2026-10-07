#!/usr/bin/env python3
"""Run headless Blender through a shared GPU slot pool.

Usage: python3 experiment/tools/blender_run.py <slug> <script.py> -- <script args...>

Every invocation that renders (has --render) must hold one of RENDER_SLOTS lock files, so ten
parallel agents cannot put ten Cycles jobs (~4 GB each) on one GPU at once. Builds/exports without
--render run immediately. Each call is appended to experiment/<slug>/blender-calls.jsonl with
wait and run times, which is how the experiment measures GPU contention.
"""
import fcntl, json, os, subprocess, sys, time
from pathlib import Path

BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender'
RENDER_SLOTS = int(os.environ.get('RENDER_SLOTS', '2'))  # CPU renders; browser tests are serialized by tools/e2e-lock.sh
# Cycles' Metal kernel compile crashes intermittently (malloc corruption, macOS crash dialogs), even
# one render at a time. Review renders are small, so Cycles always runs on the CPU here: preferences
# get no GPU backend and every render is forced to the CPU device, whatever the build script sets.
FORCE_CPU = '''
import bpy
from bpy.app.handlers import persistent
try:
    bpy.context.preferences.addons['cycles'].preferences.compute_device_type = 'NONE'
except Exception:
    pass
@persistent
def _cpu_only(scene, *_):
    if scene.render.engine == 'CYCLES':
        scene.cycles.device = 'CPU'
bpy.app.handlers.render_pre.append(_cpu_only)
'''
THREADS = os.environ.get('BLENDER_THREADS', '2')
BLENDER_SLOTS = int(os.environ.get('BLENDER_SLOTS', '3'))  # keep the shared Mac responsive
ROOT = Path(__file__).resolve().parents[1]
LOCKS = ROOT / 'tools' / '.locks'
LOCKS.mkdir(exist_ok=True)

slug, script, rest = sys.argv[1], sys.argv[2], sys.argv[3:]
renders = '--render' in rest
t0 = time.time()


def acquire(prefix, n):
    while True:
        for i in range(n):
            f = open(LOCKS / f'{prefix}{i}.lock', 'w')
            try:
                fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return f
            except BlockingIOError:
                f.close()
        time.sleep(0.5)


# Every Blender process holds one of BLENDER_SLOTS; renders additionally hold one of RENDER_SLOTS.
held = [acquire('any', BLENDER_SLOTS)]
if renders:
    held.append(acquire('slot', RENDER_SLOTS))
t1 = time.time()
cmd = [BLENDER, '--background', '--factory-startup', '-t', THREADS, '--python-expr', FORCE_CPU, '--python', script] + (['--'] + [a for a in rest if a != '--'])
proc = subprocess.run(cmd, capture_output=True, text=True)
if proc.returncode < 0:  # killed by a signal (SIGABRT/SIGSEGV): retry once, the kernel cache is usually warm by now
    time.sleep(2)
    proc = subprocess.run(cmd, capture_output=True, text=True)
t2 = time.time()
for f in held:
    fcntl.flock(f, fcntl.LOCK_UN)
    f.close()
out = proc.stdout + proc.stderr
interesting = [l for l in out.splitlines() if any(k in l for k in ('Traceback', 'Error', 'error:', 'OK', 'line '))]
print('\n'.join(interesting[-40:]))
log = ROOT / slug / 'blender-calls.jsonl'
log.parent.mkdir(exist_ok=True)
with log.open('a') as fh:
    fh.write(json.dumps({'start': t0, 'waited_s': round(t1 - t0, 1), 'ran_s': round(t2 - t1, 1), 'render': renders, 'exit': proc.returncode, 'args': rest}) + '\n')
sys.exit(proc.returncode)
