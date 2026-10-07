"""Male courier uses the shared courier weld/weight pipeline. Run Blender headless.
Blender -b --python assets/char.courier-male-skin/build.py -- --glb assets/char.courier-male-skin/model.skin.glb
"""
from pathlib import Path
import sys, runpy
sys.argv += ['--variant', 'male']
runpy.run_path(str(Path(__file__).resolve().parents[1] / 'char.courier-female-skin/build.py'), run_name='__main__')
