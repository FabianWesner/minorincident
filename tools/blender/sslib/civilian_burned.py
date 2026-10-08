"""Burned civilian shells derived from each integrated vehicle's authored tiers.

No scale fitting or decimation. Keep native anchors; freeze bent doors into the
body batch, with wheel owners still independently animatable. Missing glazing,
roof/hood tears, exposed seat frames and collapsed tyres survive every tier.
"""
import json
import math
import shutil
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix, Vector
from . import palette, sockets, export, ao
from .traffic_wrecks import box, refine, smooth, n3, WHEELS

PAINT = {'veh.sedan-red': 'survivorRed', 'veh.sedan-blue': 'policeBlue',
         'veh.sedan-white': 'picketWhite', 'veh.suv-dark': 'asphalt'}


def build_burned(directory, output):
    directory = Path(directory)
    asset = directory.name
    paint = PAINT[asset]
    tier = int(sys.argv[sys.argv.index('--distance-tier') + 1]) if '--distance-tier' in sys.argv else None
    if tier not in (None, 1, 2):
        raise ValueError('distance tier must be 1 or 2')
    stats_path = directory / 'burned-stats.json'
    stats = json.loads(stats_path.read_text()) if stats_path.exists() else {}
    for lod in ((tier,) if tier else (0, 1, 2)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(directory / ('model.lod2.glb' if lod == 2 else 'model.lod1.glb')))
        bpy.context.view_layer.update()
        root = bpy.data.objects[asset]
        meshes = [o for o in root.children_recursive if o.type == 'MESH']
        pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
        low = Vector(tuple(min(p[k] for p in pts) for k in range(3)))
        high = Vector(tuple(max(p[k] for p in pts) for k in range(3)))
        L, W, H = high - low
        glass_points = []
        info = {}
        for obj in meshes:
            parents = []
            owner = obj.parent
            while owner:
                parents.append(owner.name)
                owner = owner.parent
            wheel = next((n for n in parents if n in WHEELS), None)
            token = obj.data.materials[0].name.removeprefix('pal_').removeprefix('emi_').split('.')[0]
            glass = not wheel and (token == 'backpackTeal' or 'glass' in obj.name.lower())
            # White sedan's window panes share asphalt, isolated from low chassis.
            if not wheel and token == 'asphalt' and asset != 'veh.suv-dark':
                glass = all((obj.matrix_world @ v.co).z > low.z + .55 * H for v in obj.data.vertices)
            if glass:
                glass_points.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
                bpy.data.objects.remove(obj, do_unlink=True)
                continue
            mw = obj.matrix_world.copy()
            # Door geometry bends in place; its original hinge/socket stays exact.
            if 'doorL' in parents:
                pv = bpy.data.objects['doorL'].matrix_world.translation.copy()
                mw = Matrix.Translation(pv) @ Matrix.Rotation(math.radians(8), 4, 'Z') @ Matrix.Translation(-pv) @ mw
            obj.data.transform(mw)
            obj.parent = None
            obj.matrix_world = Matrix.Identity(4)
            # Keep four wheel draws, plus paint/char/bare-metal body draws.
            material = 'sidewalk' if wheel else (paint if token == paint else 'sidewalk' if token == 'sidewalk' else 'uiDark')
            obj.data.materials.clear()
            obj.data.materials.append(palette.mat(material))
            info[obj] = wheel
        body = bpy.data.objects.get('body')
        if body.type == 'MESH':
            body.name = 'nativeShell'
            native_body = body
            body = sockets.empty('body', parent=root)
            for child in list(native_body.children):
                world = child.matrix_world.copy()
                child.parent = body
                child.matrix_world = world
        if lod == 2:
            # Explicit far recipe: closed eight-sided tyre carcass and six-sided
            # bare hub, replacing the native wheel detail before deformation.
            for wheel in WHEELS:
                members = [o for o, w in info.items() if w == wheel]
                points = [v.co for o in members for v in o.data.vertices]
                lo = Vector(tuple(min(p[k] for p in points) for k in range(3)))
                hi = Vector(tuple(max(p[k] for p in points) for k in range(3)))
                center = (lo + hi) / 2
                radius = max(hi.x-lo.x, hi.z-lo.z) / 2
                for obj in members:
                    del info[obj]
                    bpy.data.objects.remove(obj, do_unlink=True)
                for name, sides, r, depth in [('carcass', 8, radius, hi.y-lo.y), ('hub', 6, radius*.52, (hi.y-lo.y)+.012)]:
                    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=r, depth=depth,
                        location=center, rotation=(math.pi/2, 0, 0))
                    obj = bpy.context.object
                    obj.name = wheel + '_' + name
                    obj.data.transform(obj.matrix_world)
                    obj.matrix_world = Matrix.Identity(4)
                    obj.data.materials.append(palette.mat('sidewalk'))
                    info[obj] = wheel
        original = list(info)
        for obj in original:
            wheel = info[obj]
            if wheel:
                pivot = bpy.data.objects[wheel].matrix_world.translation
                for v in obj.data.vertices:
                    # All four rubber carcasses collapsed; retain oxidized rims.
                    v.co.z = low.z + (v.co.z - low.z) * (.67 if wheel == 'wheelFL' else .81)
                    v.co.x += .025 * math.sin((v.co.z - pivot.z) * 15)
                continue
            # Conforming splits only in heat damaged panels, explicitly tiered.
            zone = lambda p: p.z > low.z + .70 * H or p.x > high.x - .32 * L
            if lod < 2 and obj.data.materials[0].name == 'pal_' + paint:
                refine(obj, [.20, .45][lod], zone, passes=[3, 2][lod])
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            # Real holes in the native hood/roof, kept clear of pillars/borders.
            torn = []
            for f in bm.faces:
                c = f.calc_center_median()
                hood = high.x - .30 * L < c.x < high.x - .12 * L and -.24 * W < c.y < .12 * W and low.z + .42 * H < c.z < low.z + .70 * H
                roof = -.16 * L < c.x < .02 * L and abs(c.y) < .19 * W and c.z > low.z + .87 * H
                if obj.data.materials[0].name == 'pal_' + paint and abs(f.normal.z) > .55 and (hood or roof):
                    torn.append(f)
            bmesh.ops.delete(bm, geom=torn, context='FACES')
            bm.to_mesh(obj.data)
            bm.free()
            for v in obj.data.vertices:
                x, y, z = v.co
                t = smooth(high.x - .33 * L, high.x, x)
                if z > low.z + .3 * H:
                    v.co.x -= .045 * L * t
                    v.co.z += .13 * math.sin(t * math.pi * 1.6) * t
                if z > low.z + .85 * H:
                    v.co.z -= .08 * math.exp(-((x / (.25 * L)) ** 2)) * (1 + .3 * n3(v.co, 4))
                if abs(y) > .30 * W and z > low.z + .3 * H:
                    dent = math.exp(-((x + .12 * L) / (.22 * L)) ** 2)
                    v.co.y -= math.copysign(.045 * dent * (1 + .5 * n3(v.co, 6)), y)
            obj.data.update()
        # Empty cabin with individually legible burned seat frames, not a solid
        # block filling the windows. Dimensions come from the actual glass region.
        if glass_points:
            gx0, gx1 = min(p.x for p in glass_points), max(p.x for p in glass_points)
        else:
            gx0, gx1 = -.30 * L, .22 * L
        floor_z = low.z + .37 * H
        def add(name, pos, size, token='uiDark', rot=(0, 0, 0)):
            obj = box(name, pos, size, token, rot)
            info[obj] = None
            return obj
        add('scorchedCabinFloor', ((gx0 + gx1) / 2, 0, floor_z), ((gx1-gx0)*.88, W*.65, .06))
        for x in (gx0 + (gx1-gx0)*.27, gx0 + (gx1-gx0)*.65):
            for y in (-W*.19, W*.19):
                add('burnedSeatPan', (x, y, floor_z+.16), (.40, .39, .08), 'sidewalk')
                add('seatFrame', (x-.18, y, floor_z+.37), (.06, .38, .42), 'sidewalk', (0, -.15, 0))
                if lod < 2:
                    add('charredSeatRemnant', (x-.135, y, floor_z+.38), (.035, .25, .24))
        # Raised/folded lip alongside the torn hood changes the top silhouette.
        add('foldedHoodLip', (high.x-.26*L, -.25*W, low.z+.63*H), (.46, .12, .045), paint, (0, -.45, -.12))
        add('exposedEngine', (high.x-.22*L, -.05*W, low.z+.44*H), (.48, W*.29, .20), 'sidewalk')
        if lod < 2:
            for k in range(4 if lod == 0 else 2):
                add('fallenBurnedTrim', (high.x-.40*L+k*.14, -.33*W, low.z+.035), (.18, .10, .045), 'uiDark', (0, 0, .6*k))
        for obj, wheel in info.items():
            owner = bpy.data.objects[wheel] if wheel else body
            obj.parent = owner
            obj.matrix_parent_inverse = owner.matrix_world.inverted()
        for obj in root.children_recursive:
            if 'ss_light' in obj:
                del obj['ss_light']
                obj['wreckLightOff'] = True
        if bpy.data.objects.get('front') is None:
            sockets.empty('front', (high.x, 0, H*.5), root)
        root['decay'] = 'burned'
        root['ss_physics'] = json.dumps({'class':'heavy', 'mass':1700 if asset == 'veh.suv-dark' else 1400,
            'friction':.85, 'restitution':.02, 'centerOfMass':[0,.6,0], 'pushable':False,
            'kickable':False, 'flammable':False, 'sounds':'prop.metal-heavy'})
        export.merge_by_material(root, set(WHEELS) | {'body'})
        meshes = [o for o in root.children_recursive if o.type == 'MESH']
        bpy.context.view_layer.update()
        ao.bake_all(meshes, 16)
        for obj in meshes:
            layer = obj.data.color_attributes.active_color
            wheel = obj.parent.name in WHEELS
            is_paint = obj.data.materials[0].name == 'pal_' + paint
            for loop in obj.data.loops:
                co = obj.data.vertices[loop.vertex_index].co
                w = obj.matrix_world @ co
                c = layer.data[loop.index].color
                if wheel:
                    # Distinct oxidized bare hub, matte black collapsed tyre.
                    hub = math.hypot(co.x, co.z) < .23
                    factor = (.42, .24, .14) if hub else (.055, .048, .055)
                elif is_paint:
                    # Broad heat/soot fields retain livery islands at game scale.
                    patch = smooth(-.28, .28, n3(w, 3.8, 7))
                    hot = smooth(.02, .40, n3(w, 1.6, 2) + .12)
                    char = .22 + .64*patch
                    factor = tuple((1-char)*(1-hot*.32)*v for v in (1, .86, .76))
                else:
                    factor = (.37, .29, .25) if obj.data.materials[0].name == 'pal_sidewalk' else (.7, .65, .65)
                layer.data[loop.index].color = (*(c[k]*factor[k] for k in range(3)), 1)
            obj.data.calc_loop_triangles()
        triangles = sum(len(o.data.loop_triangles) for o in meshes)
        draws = sum(len(o.data.materials) for o in meshes)
        if triangles > [15000, 6000, 2000][lod] or draws > 8:
            raise ValueError(f'{asset} burned LOD{lod}: {triangles} tris, {draws} draws')
        path = directory / ('model.burned' + ('' if lod == 0 else '.lod'+str(lod)) + '.glb')
        export.glb(root, path)
        stats['lod'+str(lod)] = dict(triangles=triangles, draws=draws, materials=len({m.name for o in meshes for m in o.data.materials}), bytes=path.stat().st_size)
    stats_path.write_text(json.dumps(stats, indent=2)+'\n')
    supplied = directory / ('model.burned' + ('.lod'+str(tier) if tier else '') + '.glb')
    if supplied.resolve() != Path(output).resolve():
        shutil.copyfile(supplied, output)
