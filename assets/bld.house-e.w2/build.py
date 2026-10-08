"""Source entrypoint for bld.house-e.w2; runtime delivery belongs to the base."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.house_decay import build_house
output = sys.argv[sys.argv.index('--glb')+1]
tier = int(sys.argv[sys.argv.index('--distance-tier')+1]) if '--distance-tier' in sys.argv else None
build_house(Path(__file__).resolve().parent.parent / 'bld.house-e', output, 'w2', tier)
