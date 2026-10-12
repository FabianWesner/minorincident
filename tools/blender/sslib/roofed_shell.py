"""Exterior lids for the accepted open interior kits; preserve supplied geometry and joints at every LOD."""
from pathlib import Path
import json
import sys
import bpy
from mathutils import Vector


# Exterior wall palette of the bld.* kits built on an open cutaway interior. Faces of the kit that are open (found by ray
# casting the accepted interior) get a closed wall with dark panes, so no street-facing side is ever missing (PO 10-12:
# "building without walls"). The wall lives under the cutaway `roof` node and lifts with it when the courier is inside.
SHELL_WALL = {'bld.pharmacy': 'canvasTan', 'bld.supermarket': 'brick', 'bld.gym': 'canvasTan'}
WALL = .04   # thin and OUTSIDE the interior footprint: inside it the frame would z-fight the kit's own coplanar faces


def open_faces(lo, hi):
    """Faces (axis, side) of the imported interior whose wall is missing: fewer than 80% of the probe rays hit solid geometry."""
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    scene = bpy.context.scene
    found = []
    for axis in (0, 1):
        other = 1 - axis
        for side in (-1, 1):
            hits = total = 0
            for i in range(9):
                for z in (lo[2] + .6, (lo[2] + hi[2]) / 2, hi[2] - .8):
                    along = lo[other] + .4 + (hi[other] - lo[other] - .8) * i / 8
                    origin = [0, 0, z]
                    origin[other] = along
                    origin[axis] = (hi[axis] + .6) if side > 0 else (lo[axis] - .6)
                    direction = [0, 0, 0]
                    direction[axis] = -side
                    ok, _, _, index, obj, _ = scene.ray_cast(graph, Vector(origin), Vector(direction), distance=.6 + .35)
                    total += 1
                    if ok and obj.type == 'MESH':
                        material = obj.data.materials[obj.data.polygons[index].material_index] if obj.data.materials else None
                        if not (material and material.name.startswith('keep_glass')):
                            hits += 1
            if hits / total < .8:
                found.append((axis, side))
    return found


def run(asset, interior, script):
    directory = Path(script).resolve().parent
    source = directory.parent / interior
    output = Path(sys.argv[sys.argv.index('--glb') + 1]).resolve()
    stats = {}
    open_sides = None   # decided once on the full-detail interior; every LOD gets the same walls
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
        if asset in SHELL_WALL and open_sides is None:
            open_sides = open_faces(lo, hi)
            print('SHELL open faces', asset, open_sides)
        shell = open_sides if asset in SHELL_WALL else []
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
        wall = None
        if shell:
            from . import palette
            wall = bpy.data.materials.get('pal_' + SHELL_WALL[asset]) or palette.mat(SHELL_WALL[asset])
            z0, z1 = lo[2], hi[2] - .06
            far = lod == '.lod2'   # LOD2 is capped tightly: one opaque quad per wall, the glazing only matters up close

            def quad(name, axis, side, other_range, z_range, material, depth):
                """One outward-facing quad on the face plane `depth` metres inside the footprint edge."""
                other = 1 - axis
                plane = (hi[axis] - depth) if side > 0 else (lo[axis] + depth)
                pts = []
                for o, z in ((other_range[0], z_range[0]), (other_range[1], z_range[0]), (other_range[1], z_range[1]), (other_range[0], z_range[1])):
                    v = [0, 0, z]; v[axis] = plane; v[other] = o; pts.append(tuple(v))
                outward = Vector((side if axis == 0 else 0, side if axis == 1 else 0, 0))
                normal = (Vector(pts[1]) - Vector(pts[0])).cross(Vector(pts[3]) - Vector(pts[0]))
                if normal.dot(outward) < 0:
                    pts.reverse()
                data = bpy.data.meshes.new(name); data.from_pydata(pts, [], [(0, 1, 2, 3)]); data.update()
                obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj)
                data.materials.append(material); obj.parent = roof

            for axis, side in shell:
                other = 1 - axis
                span = [lo[other], hi[other]]
                length = span[1] - span[0]
                tag = '%s%s' % ('xy'[axis], '+' if side > 0 else '-')
                if far:
                    quad('wall ' + tag, axis, side, span, (z0, z1), wall, -WALL)
                    continue
                # Frame: header, piers and sills inside the kit's own footprint (neighbouring lots stay untouched).
                # Odd opening count: the middle one is the door, open down to the floor. The openings are real holes, not
                # glass: the static batcher flattens transparency (keep_glass renders as an opaque swatch), and the
                # interior (L2 market's trapped civilians, the L3 clinic) must stay visible through them.
                count = min(5, max(3, round(length / 2.2)) | 1)
                margin, gap = .55, .45
                pane = (length - 2 * margin - (count - 1) * gap) / count
                zt = z0 + min(2.6, z1 - z0 - .7)
                sill = z0 + .9
                def frame(name, a, b, za, zb):
                    centre = [0, 0, (za + zb) / 2]
                    centre[axis] = (hi[axis] + WALL / 2) if side > 0 else (lo[axis] - WALL / 2)
                    centre[other] = (a + b) / 2
                    size = [0, 0, zb - za]
                    size[axis] = WALL
                    size[other] = b - a
                    box('%s %s' % (name, tag), tuple(centre), tuple(size), wall)
                frame('header', span[0], span[1], zt, z1)
                for k in range(count + 1):
                    a = span[0] if k == 0 else span[0] + margin + (k - 1) * (pane + gap) + pane
                    b = span[0] + margin if k == 0 else (span[1] if k == count else a + gap)
                    frame('pier%d' % k, a, b, z0, zt)
                for k in range(count):
                    a = span[0] + margin + k * (pane + gap)
                    door = k == count // 2
                    if not door:
                        frame('sill%d' % k, a, a + pane, z0, sill)
        # Two rigid material owners, 36 triangles in every tier; never decimate the lid.
        for material in set((dark, trim) + ((wall,) if wall else ())):
            parts = [o for o in roof.children if o.type == 'MESH' and o.data.materials[0] == material]
            if not parts:
                continue
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
