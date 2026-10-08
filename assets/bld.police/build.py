"""Legacy 10 x 5 x 8 m caller footprint, derived from the sole station design.

The compatibility export rescales explicit canonical tiers; it never decimates.
Canonical L3 placement uses bld.police-station. Existing D-CIVIC placements keep
bld.police's original dimensions without rebuilding or moving their district.
"""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Matrix
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.street_frontages import run
from sslib import export
output = Path(sys.argv[sys.argv.index('--glb') + 1]).resolve()
requested = int(sys.argv[sys.argv.index('--distance-tier') + 1]) if '--distance-tier' in sys.argv else None
run('bld.police-station', str(HERE.parent / 'bld.police-station/build.py'))
# Remove first-run shared links if an earlier draft of this wrapper made them.
for name in ('model.glb', 'model.lod1.glb', 'model.lod2.glb'):
    path = HERE / name
    if path.is_symlink(): path.unlink()
for tier in ((requested,) if requested is not None else (0, 1, 2)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    name = 'model' + ('.lod'+str(tier) if tier else '') + '.glb'
    bpy.ops.import_scene.gltf(filepath=str(HERE.parent / 'bld.police-station' / name))
    root = bpy.data.objects['root']
    root.matrix_world = Matrix.Diagonal((10/12, 8/16, 5/6.85, 1))
    root['asset_id'] = 'bld.police'
    root['aliasOf'] = 'bld.police-station'
    physics = json.loads(root['ss_physics'])
    physics['centerOfMass'] = [0, 2.5, 0]
    root['ss_physics'] = json.dumps(physics)
    path = HERE / name
    export.glb(root, path)
    if tier == (requested or 0) and output != path:
        import shutil
        shutil.copyfile(path, output)
