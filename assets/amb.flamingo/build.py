"""Healthy (uninfected) zoo flamingo derived from the shipped infected flamingo's exact rig and proportions.
Headless: python3 tools/blender/run.py assets/amb.flamingo/build.py --glb assets/amb.flamingo/model.glb
"""
import runpy
import sys
from pathlib import Path
sys.argv.append('--healthy')
runpy.run_path(str(Path(__file__).resolve().parents[1] / 'inf.flamingo/build.py'), run_name='__main__')
