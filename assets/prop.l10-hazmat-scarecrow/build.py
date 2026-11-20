"""Grounded stake variant of the TRELLIS-derived quarantine warning suit."""
import runpy, sys
from pathlib import Path
here=Path(__file__).resolve().parent
sys.argv.append('--field')
if '--glb' not in sys.argv: sys.argv.extend(['--glb',str(here/'model.glb')])
runpy.run_path(str(here.parent/'prop.l10-warning-effigy/build.py'),run_name='__main__')
