"""Day/night inspection of exported ss_light anchors; used by render_preview.py.

Coordinates convert glTF +Y-up to Blender +Z-up. The exported table is the
same validated anchor data consumed by the game. No source asset is modified.
"""
import json
import math
import re
from pathlib import Path
import bpy
from mathutils import Vector


def render_assets(root, asset, output):
    anchors = json.loads((root/'src/data/lightAnchors.json').read_text())
    palette = dict(re.findall(r"(light_\w+): '(#[0-9a-f]{6})'",(root/'src/data/lights.ts').read_text()))
    manifest = json.loads((root/'src/assets/manifest.json').read_text())
    exports = {Path(a['glb']).stem: a for a in manifest if a.get('glb')}
    selected = [asset] if asset else sorted(anchors)
    output.mkdir(parents=True, exist_ok=True)
    records = []
    for name in selected:
        definition = exports.get(name)
        if not definition or name not in anchors:
            raise ValueError(f'{name}: no validated light-bearing export')
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        bpy.data.orphans_purge(do_recursive=True)
        bpy.ops.import_scene.gltf(filepath=str(root/definition['glb']))
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        corners = [o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
        low = Vector([min(p[i] for p in corners) for i in range(3)])
        high = Vector([max(p[i] for p in corners) for i in range(3)])
        center = (low+high)/2
        extent = max(high-low)
        bpy.ops.mesh.primitive_plane_add(size=extent*3,location=(center.x,center.y,low.z-.01))
        floor = bpy.context.object
        floor.name = 'inspection-ground'
        floor_material = bpy.data.materials.new('inspection-asphalt')
        floor_material.diffuse_color = (.07,.075,.09,1)
        floor.data.materials.append(floor_material)
        bpy.ops.object.camera_add(location=center+Vector((1,-1,1))*extent*1.8)
        camera = bpy.context.object
        camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.type = 'ORTHO'
        camera.data.ortho_scale = extent*1.55
        scene = bpy.context.scene
        scene.camera = camera
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 8
        scene.cycles.use_denoising = True
        scene.render.resolution_x = 640
        scene.render.resolution_y = 480
        scene.render.resolution_percentage = 100
        scene.world.use_nodes = True
        background = scene.world.node_tree.nodes.get('Background')
        background.inputs['Color'].default_value = (.13,.16,.28,1)
        bpy.ops.object.light_add(type='AREA',location=center+Vector((0,-1,2))*extent)
        key = bpy.context.object
        key.data.shape = 'DISK'
        key.data.size = extent
        key.rotation_euler = (center-key.location).to_track_quat('-Z','Y').to_euler()
        practicals = []
        for anchor in anchors[name]:
            x,y,z = anchor['position']
            dx,dy,dz = anchor['direction']
            bpy.ops.object.light_add(type='SPOT' if anchor['type']=='spot' else 'POINT',location=(x,-z,y))
            light = bpy.context.object
            light.name = anchor['name']
            light.rotation_euler = Vector((dx,-dz,dy)).to_track_quat('-Z','Y').to_euler()
            hex_color = palette[anchor['color']].lstrip('#')
            rgb = [int(hex_color[i:i+2],16)/255 for i in (0,2,4)]
            light.data.color = [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
            light.data.energy = anchor['intensity']*60
            light.data.shadow_soft_size = .12
            if light.data.type=='SPOT':
                light.data.spot_size = math.radians(anchor.get('angle',45))
                light.data.spot_blend = .35
            practicals.append((light,light.data.energy))
        emissions = []
        for material in bpy.data.materials:
            if material.name.startswith('emi_') and material.use_nodes:
                shader = next((n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
                if shader:
                    emissions.append(shader.inputs['Emission Strength'])
        paths = {}
        for mode in ['day','night']:
            night = mode=='night'
            background.inputs['Strength'].default_value = .035 if night else .5
            key.data.energy = extent*extent*(.2 if night else 35)
            for light,energy in practicals:
                light.data.energy = energy if night else 0
            for emission in emissions:
                emission.default_value = 3 if night else 0
            path = output/f'{name}-{mode}.png'
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            paths[mode] = path.name
        records.append({'asset':name,'glb':definition['glb'],'anchors':len(practicals),'renders':paths})
        (output/'index.json').write_text(json.dumps(records,indent=2)+'\n')
        print(f'{name}: day/night rendered',flush=True)
