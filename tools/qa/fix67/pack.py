"""fix67-a: pack the L3-06 census, L3-13 ramp and L3-16 smoke observations into docs/reports/fix67-a (images stay in test-results)."""
import json, glob, os

root = os.path.join(os.path.dirname(__file__), '..', '..', '..')
os.chdir(root)
out = 'docs/reports/fix67-a'
os.makedirs(out, exist_ok=True)

census = {}
for label in ['base', 'final']:
    census[label] = [json.load(open(f)) for f in sorted(glob.glob(f'test-results/fix67/squad-{label}/*.json'))]
json.dump({'row': 'L3-06', 'method': 'tools/qa/fix67/l3-squad.sh: mortal native complete run per seed 1-3 and tier (as qa:accept); followRange = calm samples every 30 ticks in S1-S3 (no living infected within 20 m of the courier, no squad target). base = main e061357, final = lane/fix67-a.',
           'runs': census}, open(f'{out}/L3-06-census.json', 'w'), indent=1)

rows = json.load(open('test-results/fix67/ramp-high-webgl2/ramp.json'))
offsets = dict(line.split(' ', 1) for line in open('test-results/fix67/ramp-offsets.txt').read().strip().split('\n'))
json.dump({'row': 'L3-13', 'tier': 'high', 'backend': 'webgl2',
           'method': 'Native complete InputFrames to x>=126 (courier damage off), then physical keyboard only (WASD held toward the next authored ramp-road point projected to the screen) up both S-ramps to the central span. Frames at actual zoom 0.5 and 1.5 at x 141/146/150/154/158/163/170 plus x150 after 10 s standing. Lateral offsets from the authored centreline: tools/qa/fix67/ramp-offsets.ts (deck half-width 2.31 m).',
           'frames': [{'file': 'test-results/fix67/ramp-high-webgl2/' + r['shot'], 'tick': r['tick'], 'player': r['player'], 'livingInfectedNearRamp': len(r['near']), 'offDeckCentreOver1_9m': offsets.get(r['shot'], '')} for r in rows if 'shot' in r]},
          open(f'{out}/L3-13-ramp-high.json', 'w'), indent=1)

smoke = {tier: json.load(open(f'test-results/fix67/smoke-{tier}/frames.json')) for tier in ['low', 'high']}
json.dump({'row': 'L3-16', 'method': 'tools/qa/fix67/l3-smoke-route.ts: native complete route (courier damage off), default zoom 1, one frame every 25 m from x -110 to 115, both tiers; chosen street columns recorded per frame. Sheets: test-results/fix67/smoke-low-sheet.jpg, smoke-high-sheet.jpg.',
           'frames': smoke}, open(f'{out}/L3-16-route-frames.json', 'w'), indent=1)
print('packed')
