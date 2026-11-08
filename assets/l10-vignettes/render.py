"""CPU-only asset QA sheet cells. No browser or interactive Blender window."""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'docs/reports/eg-l10-vignettes/assets'
OUT.mkdir(parents=True, exist_ok=True)
ids = ['prop.l10-grave-cross','decay.body-bag','prop.l10-quarantine-tape','prop.l10-cow-carcass','prop.l10-shovel','prop.l10-corpse-back','prop.l10-corpse-side','prop.l10-corpse-crumple','prop.l10-abandoned-sedan-blue','prop.l10-abandoned-sedan-white','prop.l10-crashed-helicopter']
if '--asset' in sys.argv:
    selected=sys.argv[sys.argv.index('--asset')+1]
    if selected not in ids: raise ValueError(selected)
    ids=[selected]
cells = []
for asset in ids:
    for lod in range(3):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 8
        scene.render.threads_mode = 'FIXED'; scene.render.threads = 1
        scene.render.resolution_x = 360; scene.render.resolution_y = 260; scene.render.resolution_percentage = 100
        scene.world = bpy.data.worlds.new('studio'); scene.world.use_nodes = True
        scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.32,.35,.38,1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value = .65
        bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets'/asset/('model.glb' if lod == 0 else f'model.lod{lod}.glb')))
        objs = [o for o in scene.objects if o.type == 'MESH']
        points = [o.matrix_world@Vector(v) for o in objs for v in o.bound_box]
        lo=Vector([min(v[i] for v in points) for i in range(3)]); hi=Vector([max(v[i] for v in points) for i in range(3)])
        k=2.7/max(hi-lo); shift=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
        parent=bpy.data.objects.new('sheet_transform',None); scene.collection.objects.link(parent)
        for o in [o for o in list(scene.objects) if o.parent is None and o!=parent]: o.parent=parent
        parent.scale=(k,k,k); parent.location=-shift*k
        bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025))
        floor=bpy.data.materials.new('floor'); floor.diffuse_color=(.13,.16,.18,1); bpy.context.object.data.materials.append(floor)
        bpy.ops.object.light_add(type='AREA',location=(-3,-4,7)); bpy.context.object.data.energy=500; bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=5
        bpy.ops.object.camera_add(location=(4,-5,3.8)); camera=bpy.context.object
        camera.rotation_euler=(Vector((0,0,1))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=4.7; scene.camera=camera
        scene.view_settings.view_transform='Standard'
        path=OUT/f'{asset}-lod{lod}.png'; scene.render.filepath=str(path); bpy.ops.render.render(write_still=True)
        cells.append({'asset':asset,'lod':lod,'path':str(path.relative_to(ROOT))})
if '--asset' not in sys.argv: (OUT/'cells.json').write_text(json.dumps(cells,indent=2)+'\n')
