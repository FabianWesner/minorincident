"""Benchmark every round's GLB (25 copies, game camera, WebGPU + WebGL2) sequentially into results/bench.json.
Run only when no build jobs are rendering, or the numbers measure GPU contention instead of the asset."""
import json, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
out = ROOT / 'results' / 'bench.json'
res = json.loads(out.read_text()) if out.exists() else {}
subs = sys.argv[1:] or ['sol', 'stylized']
for glb in sorted(ROOT.glob('*/*/model.glb')):
    if glb.parent.name not in subs:
        continue
    src = '/' + str(glb.relative_to(ROOT.parent))
    p = subprocess.run(['node', str(ROOT / 'tools' / 'bench_glb.mjs'), src, '25'], capture_output=True, text=True, cwd=ROOT.parent)
    try:
        res[src] = json.loads(p.stdout.strip().splitlines()[-1])
        print(src, res[src]['webgpu']['medianMs'], res[src]['webgl2']['medianMs'])
    except Exception:
        print('FAILED', src, p.stderr[-300:])
    out.write_text(json.dumps(res, indent=1))
