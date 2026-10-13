"""Infected dog: the generic dog base with infection enabled (patchy fur, exposed ribs, fangs, red eyes, lower stance).
Headless: python3 tools/blender/run.py assets/inf.dog/build.py --glb assets/inf.dog/model.glb --lod 0 [--coat base|black|cream]
Same rig, node contract and clips as amb.dog; the geometry is authored per tier from the same builder, never decimated.
"""
import argparse
import runpy
import sys
from pathlib import Path

base = Path(__file__).resolve().parent.parent / 'amb.dog/build.py'
parser = argparse.ArgumentParser()
parser.add_argument('--glb', required=True)
parser.add_argument('--quality', default='high')
parser.add_argument('--lod', type=int, choices=[0, 1, 2], default=0)
parser.add_argument('--coat', default='base')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
runpy.run_path(str(base), run_name='dog_base')['export_dog'](args.glb, args.lod, infected=True, coat=args.coat)
