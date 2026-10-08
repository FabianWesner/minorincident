"""Burned clapboard house wall: broken gable, collapsed roof edge, charred frames (see notes.md)."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools/blender'))
from sslib.burned_facades import build_set
build_set('decay.burned-facade.house',Path(__file__).parent,sys.argv[sys.argv.index('--glb')+1] if '--glb' in sys.argv else None)
