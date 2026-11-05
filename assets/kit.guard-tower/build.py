"""Checkpoint watchtower extracted from the existing army kit, authored at every LOD."""
import sys
from pathlib import Path
import bpy
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.rescue_assets import Scene, finish
from sslib import colliders
import json
stats = {}
for lod in (0, 1, 2):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = Scene('kit.guard-tower', lod)
    for x in (-1.2, 1.2):
        for y in (-1.2, 1.2):
            s.box('towerLeg', (x, y, 2.45), (.14, .14, 4.9), 'woodWarm')
            colliders.cuboid('leg', (.14, .14, 4.9), (x, y, 2.45), s.root)
    s.box('towerDeck', (0, 0, 4.15), (2.8, 2.8, .22), 'woodWarm')
    colliders.cuboid('deck', (2.8, 2.8, .22), (0, 0, 4.15), s.root)
    for y in (-1.3, 1.3):
        s.box('towerRailing', (0, y, 4.6), (2.8, .1, .55), 'khaki')
        colliders.cuboid('rail', (2.8, .1, .55), (0, y, 4.6), s.root)
    # West face stays open for firing; ladder is on the east, away from the approach.
    for x in (.95, 1.65):
        s.box('ladderRail', (x, 0, 2.1), (.06, .08, 4.2), 'woodWarm')
    for z in ([i * .34 + .3 for i in range(13)] if lod < 2 else [1, 2, 3]):
        s.box('ladderRung', (1.3, 0, z), (.7, .09, .06), 'woodWarm')
    if lod < 2:
        for y in (-1.2, 1.2):
            s.beam('brace', (-1.2, y, .3), (1.2, y, 3.9), .08, 'woodWarm')
            s.beam('brace', (1.2, y, .3), (-1.2, y, 3.9), .08, 'woodWarm')
    stats['lod' + str(lod)] = finish(s, HERE / ('model' + ('' if lod == 0 else '.lod' + str(lod)) + '.glb'))
(HERE / 'authored-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
if '--glb' in sys.argv:
    import shutil
    output = Path(sys.argv[sys.argv.index('--glb') + 1]).resolve()
    if output != HERE / 'model.glb': shutil.copyfile(HERE / 'model.glb', output)
