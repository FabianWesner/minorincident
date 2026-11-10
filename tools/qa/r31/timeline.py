"""r31-zombie-audit helper: clip timeline of the audited actor and dense frame strips from the Scene Lab video.

python3 tools/qa/r31/timeline.py <scene out dir> [strip name:startFrame:endFrame ...]
Prints run-length clip segments (frame ranges per clip) of actor `z` from metrics.json (needs "trace": true),
then writes <dir>/strip-<name>.jpg: every video frame (3 sim ticks) in the window, tiled 8 per row.
"""
import json, subprocess, sys, pathlib

d = pathlib.Path(sys.argv[1])
m = json.load(open(d / 'metrics.json'))
a = m['metrics']['actors']['z']
track = a.get('track', [])
segs = []
for s in track:
    clip = s.get('clip') or s.get('label') or '-'
    if segs and segs[-1][0] == clip:
        segs[-1][2] = s['frame']
    else:
        segs.append([clip, s['frame'], s['frame']])
print(d.name, 'health', a.get('health'), 'state', a.get('state'), 'slideMaxCm', a.get('motion', {}).get('slideMaxCm'), 'p95', a.get('motion', {}).get('slideP95Cm'))
print(' '.join(f'{c}[{f0}-{f1}]' for c, f0, f1 in segs))
raw = d / 'video.webm.mjpeg'
src = ['-f', 'mjpeg', '-framerate', '20', '-i', str(raw)] if raw.exists() else ['-i', str(d / 'video.webm')]
for arg in sys.argv[2:]:
    name, f0, f1, *mode = arg.split(':')
    f0, f1 = int(f0), int(f1)
    n = (f1 - f0) // 3 + 1
    rows = (n + 7) // 8
    out = d / f'strip-{name}.jpg'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{f0 / 60:.3f}', '-t', f'{(f1 - f0) / 60:.3f}', *src, '-frames:v', '1',
                    '-vf', (f'scale=320:-1,tile=6x{(n + 5) // 6}' if mode else f'crop=iw*0.5:ih*0.8:iw*0.25:ih*0.1,scale=256:-1,tile=8x{rows}'),
                    '-q:v', '4', str(out)], check=True)
    print('wrote', out)
