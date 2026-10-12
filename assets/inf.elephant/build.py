"""Infected appearance derived from the normal elephant's exact build and rig."""
import runpy
import sys
from pathlib import Path
sys.argv.append('--infected')
runpy.run_path(str(Path(__file__).resolve().parents[1] / 'amb.elephant/build.py'), run_name='__main__')
