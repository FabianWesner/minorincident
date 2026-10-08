"""Authored standing brick frontage damage."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools/blender'))
from sslib.burned_facades import build_set
build_set('decay.burned-facade.brick',Path(__file__).parent,sys.argv[sys.argv.index('--glb')+1] if '--glb' in sys.argv else None)
