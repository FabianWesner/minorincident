"""Own round-3 foliage trunks and preview/collision proxies; runtime replaces proxies with leaf cards.
Assembly adapted from Bruno Simon folio-2025 World/Trees.js (MIT).
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector
from sslib.palette import mat


def build(asset_id, glb, segments=12):
    root_path = Path(__file__).resolve().parents[3]
    definition = next(a for a in json.loads((root_path/'src/assets/manifest.json').read_text()) if a['id'] == asset_id)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    root = bpy.data.objects.new('root', None); bpy.context.collection.objects.link(root); root['asset_id'] = asset_id
    def empty(name, position):
        o = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(o); o.parent = root; o.location = (position[0], -position[2], position[1]); return o
    def branch(name, start, end, radius, end_radius):
        a, b = Vector((start[0], -start[2], start[1])), Vector((end[0], -end[2], end[1])); direction = b-a
        bpy.ops.mesh.primitive_cone_add(vertices=segments, radius1=radius, radius2=end_radius, depth=direction.length, location=(a+b)/2)
        o=bpy.context.object; o.name=name; o.parent=root; o.rotation_euler=direction.to_track_quat('Z','Y').to_euler(); o.data.materials.append(mat('woodWarm'))
        bevel=o.modifiers.new('rounded bark edges','BEVEL'); bevel.width=.045; bevel.segments=3
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=bevel.name)
        for p in o.data.polygons:p.use_smooth=True
        return o
    tree = asset_id.startswith('prop.street-tree')
    if tree:
        branch('body', (0,0,0),(.12,2.9,.06),.23,.115)
        for k, end in enumerate([(-.8,3.25,.25),(.8,3.4,-.22),(.18,3.65,.65)]): branch('limb:'+str(k),(.08,2.05,0),end,.12,.045)
        # Exposed root flares anchor the soft crown to the lawn.
        for k in range(5):
            a=k*math.tau/5;branch('root-flare:'+str(k),(0,.35,0),(.4*math.cos(a),.07,.4*math.sin(a)),.13,.045)
    else:
        branch('body',(0,0,0),(0,.65,0),.1,.035)
    empty('front', (definition['dimensions']['x']/2,0,0))
    for i,crown in enumerate(definition['foliage']['crowns']):
        marker=empty('crown:'+str(i),crown['position']);marker.scale=(crown['radius'][0],crown['radius'][2],crown['radius'][1]);marker['foliageColors']=definition['foliage']['colors']
    # Smooth proxy matches the declared whole-asset silhouette and provides current body-height collision.
    dims=definition['dimensions'];bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,radius=1,location=(0,0,dims['y']/2))
    o=bpy.context.object;o.name='crownProxy';o.parent=root;o['foliageProxy']=True;o.data.materials.append(mat('foliage'))
    if tree:
        o.location.z=(dims['y']+1.9)/2;o.scale=(dims['x']/2,dims['z']/2,(dims['y']-1.9)/2)
    else:o.scale=(dims['x']/2,dims['z']/2,dims['y']/2)
    # The leaf fringe extends beyond the dense hedge body. Keep the physical
    # body slightly inset so the existing porch/diner corner routes stay open.
    if asset_id=='prop.hedge':o.scale.x=1.15
    for p in o.data.polygons:p.use_smooth=True
    col=empty('col:trunk' if tree else 'col:bush',(0,1.2 if tree else dims['y']/2,0));col['collider']='cuboid';col['size']=[.5,.5,2.4] if tree else [dims['x'],dims['z'],dims['y']]
    bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(glb).resolve()),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
    print('OK',asset_id,glb)
