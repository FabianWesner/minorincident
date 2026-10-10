"""Source entrypoint for bld.clinic-annex.burned; runtime delivery belongs to the base (decay variant `burned`).
Run headless: Blender -b --python assets/bld.clinic-annex.burned/build.py -- [--glb out.glb] [--distance-tier N]
Writes assets/bld.clinic-annex/model.burned.glb, model.burned.lod1.glb and model.burned.lod2.glb; then
`npm run assets:pack -- bld.clinic-annex` publishes the runtime tiers."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.clinic_burned import build
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
output = argv[argv.index('--glb') + 1] if '--glb' in argv else None
tier = int(argv[argv.index('--distance-tier') + 1]) if '--distance-tier' in argv else None
build(Path(__file__).resolve().parent.parent / 'bld.clinic-annex', output, tier)
