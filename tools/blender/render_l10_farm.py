"""No-browser farm evidence: native Cycles renders with the production camera geometry.

Run after build_l10_farm.py. Before GLBs are extracted from the named base revision
by tools/qa/r15-farmassets.ts; no image in this report is a browser capture.
"""
import bpy
import math
import json
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/r15-farmassets'
OUT = CACHE / 'renders'
OUT.mkdir(parents=True, exist_ok=True)
IDS = ['veg.corn-block', 'bld.farm-barn-ruin', 'bld.farm-house-ruin',
       'prop.farm-tractor', 'prop.farm-combine']


def scene_setup(width, height):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 12
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 3
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'
    scene.world = bpy.data.worlds.new('farm-evidence-world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.10,.12,.16,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
    bpy.ops.object.light_add(type='AREA', location=(8,-10,16))
    key = bpy.context.object
    key.data.energy, key.data.size = 2200, 10
    key.rotation_euler = (Vector((0,0,0))-key.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.light_add(type='SUN', location=(-4,3,12))
    bpy.context.object.data.energy = 1.7
    bpy.context.object.rotation_euler = (.4,-.6,-.5)
    bpy.ops.object.camera_add()
    scene.camera = bpy.context.object
    return scene


def import_asset(asset, lod=0, burned=False, before=False, at=(0,0,0), yaw=0):
    folder = CACHE/'before' if before and asset in IDS else ROOT
    suffix = ('.burned' if burned else '') + (f'.lod{lod}' if lod else '')
    path = folder/'assets'/asset/f'model{suffix}.glb'
    previous = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = set(bpy.data.objects)-previous
    for obj in objects:
        if obj.parent not in objects:
            obj.location = at
            obj.rotation_euler.z += yaw
    return objects


def point_camera(scene, target, radius, orthographic=False):
    # Three spherical (r, .3*pi, pi/4), mapped from Y up to Blender Z up.
    polar = math.pi*.3
    offset = Vector((math.sin(polar)/math.sqrt(2),-math.sin(polar)/math.sqrt(2),math.cos(polar)))*radius
    camera = scene.camera
    camera.location = Vector(target)+offset
    camera.rotation_euler = (-offset).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'ORTHO' if orthographic else 'PERSP'
    camera.data.sensor_fit = 'VERTICAL'
    camera.data.sensor_height = 24
    camera.data.lens = 24/(2*math.tan(math.radians(25)/2))
    if orthographic:
        camera.data.ortho_scale = radius


def render(scene, name):
    scene.render.filepath = str(OUT/f'{name}.png')
    bpy.ops.render.render(write_still=True)


def asset_sheet():
    rows = [(asset,False) for asset in IDS]
    rows += [(asset,True) for asset in IDS if asset!='veg.corn-block']
    if '--asset' in sys.argv:
        rows=[row for row in rows if row[0]==sys.argv[sys.argv.index('--asset')+1]]
    for asset,burned in rows:
        for lod in range(3):
            scene=scene_setup(480,320)
            objects=import_asset(asset,lod,burned)
            bpy.context.view_layer.update()
            points=[obj.matrix_world@Vector(p) for obj in objects if obj.type=='MESH' for p in obj.bound_box]
            lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
            hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
            center=(lo+hi)/2
            point_camera(scene,center,max(hi.x-lo.x,hi.y-lo.y,(hi.z-lo.z)*1.8)*.95,True)
            render(scene,f'sheet-{asset}{"-burned" if burned else ""}-lod{lod}')


def comparisons():
    # Fixed metre-scale comparison fixture: plot and field spacing match the ten-metre
    # farm kit. Each row isolates the relevant silhouette at the actual L10 follow lens.
    fixtures = {
        'barn': [('bld.farm-barn-ruin',(0,0,0)),('veg.corn-block',(-10,1,0)),('prop.farm-scarecrow',(-6,-3,0))],
        'house': [('bld.farm-house-ruin',(0,0,0)),('veg.corn-block',(-10,1,0)),('prop.farm-carcass',(5,-1,0))],
        'machines': [('prop.farm-tractor',(2,-2,0)),('prop.farm-combine',(-2,2,0)),('veg.corn-block',(-8,-2,0))],
        'field-low': [('veg.corn-block',(x,y,0)) for x in [-10,0,10] for y in [-10,0,10]],
        'field-high': [('veg.corn-block',(x,y,0)) for x in [-10,0,10] for y in [-10,0,10]],
    }
    if '--close' in sys.argv:
        fixtures={}
    if '--fixture' in sys.argv:
        selected=sys.argv[sys.argv.index('--fixture')+1]
        fixtures={key:value for key,value in fixtures.items() if key==selected}
    for label,placements in fixtures.items():
        for before in [True,False]:
            scene=scene_setup(800,450)
            # Native night inspection: a cool moon/fill and one warm practical.
            # The game applies additional palette grading and fog in its own renderer.
            scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.16,.21,.31,1)
            scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
            for light in [o for o in scene.objects if o.type=='LIGHT']:
                light.data.color=(.63,.72,1)
                light.data.energy=650 if light.data.type=='AREA' else .7
            bpy.ops.object.light_add(type='POINT',location=(5,-4,2.8))
            bpy.context.object.data.energy=170
            bpy.context.object.data.color=(1,.56,.22)
            bpy.context.object.data.shadow_soft_size=1.1
            for asset,at in placements:
                burned=not before and (asset=='prop.farm-combine' or label=='house' and asset=='bld.farm-house-ruin')
                import_asset(asset,1 if label=='field-low' else 0,burned=burned,before=before,at=at)
            bpy.ops.mesh.primitive_plane_add(size=200)
            floor=bpy.context.object
            material=bpy.data.materials.new('evidence-dry-earth')
            material.use_nodes=True
            material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.075,.06,.042,1)
            material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.95
            floor.data.materials.append(material)
            for zoom in [1,1.5]:
                # L10's road widening = 1.3; user zoom is a radius multiplier.
                point_camera(scene,(0,0,.0),19*1.3*zoom)
                render(scene,f'{label}-{"before" if before else "after"}-z{zoom}')
    for before in ([] if '--fixture' in sys.argv else [True,False]):
        scene=scene_setup(800,450)
        import_asset('veg.corn-block',before=before)
        point_camera(scene,(1,0,1.0),8)
        render(scene,f'corn-close-{"before" if before else "after"}')
    (OUT/'camera.json').write_text(json.dumps(dict(
        renderer='Blender Cycles CPU, 12 samples', baseRevision='08149d1a',
        fovVerticalDegrees=25, radiusMetres=19, polarRadians=math.pi*.3,
        azimuthRadians=math.pi/4, l10RoadScale=1.3, zoom=[1,1.5],
        fixture='Fixed asset review staging in metres; not a runtime frame',
        closeInspectionRadiusMetres=8,
        shader='Native glTF palette PBR, cool night inspection light and warm practical; no runtime grade, fade or wind',
    ),indent=2)+'\n')


if '--sheet' in sys.argv:
    asset_sheet()
else:
    comparisons()
