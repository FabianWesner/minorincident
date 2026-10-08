"""Base-owned W3 delivery; use assets:build -- bld.maple-hardware --decay w3."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.commerce_damage import build_variants
if __name__ == '__main__':
    output = sys.argv[sys.argv.index('--glb') + 1] if '--glb' in sys.argv else str(Path(__file__).parent.parent / 'bld.maple-hardware/model.w3.glb')
    tier = int(sys.argv[sys.argv.index('--distance-tier') + 1]) if '--distance-tier' in sys.argv else None
    build_variants(Path(__file__).parent.parent / 'bld.maple-hardware/build.py', 'w3', output, tier)
