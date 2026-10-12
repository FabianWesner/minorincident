"""Exterior lids for the accepted open interior kits; preserve supplied geometry and joints at every LOD."""
from pathlib import Path
import json
import sys
import bpy
from mathutils import Vector


def run(asset, interior, script):
    directory = Path(script).resolve().parent
    source = directory.parent / interior
    output = Path(sys.argv[sys.argv.index('--glb') + 1]).resolve()
    stats = {}
    for lod in ('', '.lod1', '.lod2'):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(source / ('model' + lod + '.glb')))
        # Supplied interior tiers are immutable inputs; only the roof is newly authored here.
        if 'deliveryLodGenerated' in bpy.context.scene:
            del bpy.context.scene['deliveryLodGenerated']
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        points = [o.matrix_world @ Vector(p) for o in meshes for p in o.bound_box]
        lo = [min(p[i] for p in points) for i in range(3)]
        hi = [max(p[i] for p in points) for i in range(3)]
        root = bpy.data.objects.get('root')
        roof = bpy.data.objects.new('roof', None)
        bpy.context.collection.objects.link(roof)
        roof.parent = root
        roof['cutaway'] = True
        root['assetId'] = asset
        dark = bpy.data.materials.get('pal_uiDark') or bpy.data.materials.get('pal_asphalt')
        if dark is None:
            dark = bpy.data.materials.new('pal_uiDark'); dark.diffuse_color = (.019, .016, .025, 1)
        # Distance tiers that fold picketWhite into sidewalk (int.supermarket LOD2) keep a light coping instead of falling back to the dark membrane.
        trim = dark if asset == 'int.basement-cellar' else bpy.data.materials.get('pal_picketWhite') or bpy.data.materials.get('pal_sidewalk') or dark
        cx, cy = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
        sx, sy = hi[0] - lo[0], hi[1] - lo[1]
        # Warm coping and a charcoal membrane, like the adjacent flat-roof shops.
        # Keep the existing footprint; the thin lid fits the declared height tolerance.
        def box(name, pos, size, material):
            bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
            obj = bpy.context.object; obj.name = name; obj.scale = size
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            obj.data.materials.append(material)
            world = obj.matrix_world.copy(); obj.parent = roof; obj.matrix_world = world
        # Offset the lid from the original wall coping: coincident top/side faces
        # flicker at the game camera. A 2 cm inset and 9.5 cm lift keep every footprint
        # unchanged and stay within even the cellar's 3% height tolerance.
        box('roof deck', (cx, cy, hi[2] - .015), (sx - .04, sy - .04, .10), dark)
        # A continuous coping ring (top, outer and inner faces). Its underside is
        # sealed by the deck, so 36 added triangles fit the original LOD caps.
        outer = [(lo[0]+.02,lo[1]+.02),(hi[0]-.02,lo[1]+.02),
                 (hi[0]-.02,hi[1]-.02),(lo[0]+.02,hi[1]-.02)]
        inner = [(lo[0]+.20,lo[1]+.20),(hi[0]-.20,lo[1]+.20),
                 (hi[0]-.20,hi[1]-.20),(lo[0]+.20,hi[1]-.20)]
        vertices = [(x,y,z) for z in (hi[2]+.035,hi[2]+.095) for ring in (outer,inner) for x,y in ring]
        faces = []
        for i in range(4):
            j = (i+1)%4
            faces += [(8+i,8+j,12+j,12+i), (i,j,8+j,8+i), (4+j,4+i,12+i,12+j)]
        data = bpy.data.meshes.new('roof coping'); data.from_pydata(vertices, [], faces); data.update()
        coping = bpy.data.objects.new('roof coping',data); bpy.context.collection.objects.link(coping)
        data.materials.append(trim); world = coping.matrix_world.copy(); coping.parent = roof; coping.matrix_world = world
        # Two rigid material owners, 36 triangles in every tier; never decimate the lid.
        for material in set((dark, trim)):
            parts = [o for o in roof.children if o.type == 'MESH' and o.data.materials[0] == material]
            bpy.ops.object.select_all(action='DESELECT')
            for obj in parts: obj.select_set(True)
            bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
            parts[0].name = 'roof_' + material.name
        if asset in ('bld.supermarket', 'int.basement-cellar'):
            # Same palette folding as house_decay.batch: retain all six hinges,
            # silhouettes and AO while each fridge door uses one draw instead of three.
            white = bpy.data.materials.get('pal_picketWhite')
            if white is None:
                from . import palette
                white = palette.mat('picketWhite')
            base = white.diffuse_color[:3]
            for obj in list(bpy.context.scene.objects):
                if obj.type != 'MESH' or not obj.name.startswith(('door_fridge_', 'door_cellar_')):
                    continue
                data = obj.data
                old = data.color_attributes.active_color
                colors = [tuple(v.color) for v in old.data] if old else None
                layer = data.color_attributes.new(name='palette', type='FLOAT_COLOR', domain='CORNER')
                for polygon in data.polygons:
                    rgb = data.materials[polygon.material_index].diffuse_color[:3]
                    for i in polygon.loop_indices:
                        ao = colors[i if old.domain == 'CORNER' else data.loops[i].vertex_index] if colors else (1, 1, 1, 1)
                        layer.data[i].color = (*[min(1, rgb[k] / base[k]) * ao[k] for k in range(3)], 1)
                    polygon.material_index = 0
                data.color_attributes.active_color = layer
                data.materials.clear(); data.materials.append(white)
        if asset == 'int.basement-cellar':
            doors = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.startswith('door_cellar_')]
            bpy.ops.object.select_all(action='DESELECT')
            for obj in doors: obj.select_set(True)
            bpy.context.view_layer.objects.active = doors[0]; bpy.ops.object.join()
            doors[0].name = 'door_cellar_pal_picketWhite'
        bpy.ops.object.select_all(action='SELECT')
        path = output if not lod else directory / ('model' + lod + '.glb')
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', export_extras=True, export_yup=True)
        if not lod:
            bpy.ops.export_scene.gltf(filepath=str(directory / 'model.glb'), export_format='GLB', export_extras=True, export_yup=True)
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        points = [o.matrix_world @ Vector(p) for o in meshes for p in o.bound_box]
        final_hi = [max(p[i] for p in points) for i in range(3)]
        for obj in meshes: obj.data.calc_loop_triangles()
        stats['lod' + (lod[-1] if lod else '0')] = {
            'triangles': sum(len(o.data.loop_triangles) for o in meshes),
            'draws': sum(len(set(p.material_index for p in o.data.polygons)) for o in meshes),
            'materials': len({m.name for o in meshes for m in o.data.materials}),
            'bytes': (directory / ('model' + lod + '.glb')).stat().st_size,
            'bounds': {'min': lo, 'max': final_hi},
            'dimensions': {'x': sx, 'y': final_hi[2] - lo[2], 'z': sy, 'tolerance': .03},
        }
    (directory / 'lod-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
