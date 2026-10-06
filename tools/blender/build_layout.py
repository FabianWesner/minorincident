"""Headless layout entry point; never imports gameplay data."""
import runpy
import sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root/'tools/blender'))
district=sys.argv[sys.argv.index('--')+1]
if district not in ['D-RES','D-MAIN','D-SCHOOL','D-SHOP','D-CIVIC','D-PARK','D-ZOO','D-EDGE','D-GROVE']: raise ValueError(district)
runpy.run_path(str(root/'layouts'/district/'layout.py'),run_name='__main__')
