"""Infection is a material variant of the normal zebra, with identical rig/LODs.
Headless: python3 tools/blender/run.py assets/inf.zebra/build.py --glb assets/inf.zebra/model.glb --lod 0
"""
import argparse
import runpy
import sys
from pathlib import Path

base = Path(__file__).resolve().parent.parent / 'amb.zebra/build.py'
parser = argparse.ArgumentParser()
parser.add_argument('--glb', required=True)
parser.add_argument('--quality', default='high')
parser.add_argument('--lod', type=int, choices=[0, 1, 2], default=0)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
runpy.run_path(str(base), run_name='zebra_base')['export_zebra'](args.glb, args.lod, infected=True)
