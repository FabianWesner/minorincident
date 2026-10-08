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
    # Native tier exports can carry different centering transforms. The shipped
    # base owns the runtime anchor contract, so snapshot it before authoring.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    production = directory.parents[1] / 'public/assets/models' / (asset + '.glb')
    bpy.ops.import_scene.gltf(filepath=str(production))
    bpy.context.view_layer.update()
    anchors = {o.name: o.matrix_world.copy() for o in bpy.context.scene.objects
               if o.type == 'EMPTY' and not o.name.startswith(('mesh_', 'Scene'))}
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
                # Glazing and low underbody can share one imported primitive.
                # Remove the high glazing faces, retaining the low chassis.
                bm = bmesh.new()
                bm.from_mesh(obj.data)
                panes = [f for f in bm.faces if all(
                    (obj.matrix_world @ v.co).z > low.z + .55 * H for v in f.verts)]
                glass_points.extend(obj.matrix_world @ v.co for f in panes for v in f.verts)
                bmesh.ops.delete(bm, geom=panes, context='FACES')
                bm.to_mesh(obj.data)
                bm.free()
                if not obj.data.polygons:
                    bpy.data.objects.remove(obj, do_unlink=True)
                    continue
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
            if asset == 'veh.sedan-white' and token == 'uiDark' and not wheel:
                # The intact white sedan has solid black gasket backing behind
                # its glass. Tear that backing away as well, preserving a real
                # cabin opening; the surviving perimeter is authored below.
                bm = bmesh.new()
                bm.from_mesh(obj.data)
                def screen_point(p):
                    if not (1.19 < p.z < 1.78 and abs(p.y) < .85):
                        return False
                    t = (p.z - 1.22) / (1.745 - 1.22)
                    return any(abs(p.x - (xb + (xt-xb)*t)) < .065
                               for xb, xt in [(1.035, .46), (-1.48, -.95)])
                faces = [f for f in bm.faces if all(screen_point(v.co) for v in f.verts)]
                bmesh.ops.delete(bm, geom=faces, context='FACES')
                bm.to_mesh(obj.data)
                bm.free()
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
            # Cut bounded, closed openings rather than deleting whole native
            # triangles: continuous roof/hood borders survive even at distance.
            if obj.data.materials[0].name == 'pal_' + paint:
                # glTF splits vertices at normal seams. Restore the native
                # closed solids before a boolean so cutters cannot become caps.
                bm = bmesh.new()
                bm.from_mesh(obj.data)
                bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
                bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
                bm.to_mesh(obj.data)
                bm.free()
                for center, size in [
                    ((-.06*L, 0, low.z+.96*H), (.14*L, .28*W, .28*H)),
                    ((high.x-.22*L, -.05*W, low.z+.56*H), (.14*L, .26*W, .24*H)),
                ]:
                    if lod == 2 and center[0] > high.x-.4*L:
                        # Far retains a folded hood, roof hole and missing glass;
                        # omit the complex multi-panel engine-bay cut outline.
                        continue
                    cutter = box('heatTearCutter', center, size, 'uiDark')
                    bpy.context.view_layer.update()
                    bpy.ops.object.select_all(action='DESELECT')
                    obj.select_set(True)
                    bpy.context.view_layer.objects.active = obj
                    modifier = obj.modifiers.new('authoredHeatOpening', 'BOOLEAN')
                    modifier.operation = 'DIFFERENCE'
                    modifier.solver = 'EXACT'
                    modifier.use_self = lod < 2
                    modifier.use_hole_tolerant = True
                    modifier.object = cutter
                    bpy.ops.object.modifier_apply(modifier=modifier.name)
                    bpy.data.objects.remove(cutter, do_unlink=True)
                # Heat ripples and broad soot fields have explicit near/mid
                # density; distant panels retain the bounded cut outline.
                if lod < 2:
                    zone = lambda p: p.z > low.z + .70*H or p.x > high.x-.32*L
                    refine(obj, [.20, .55][lod], zone, passes=[3, 1][lod])
            if lod == 2:
                # Fuse coplanar triangulated static panels without moving any
                # vertex or changing holes/borders (same as native distance.py).
                bm = bmesh.new()
                bm.from_mesh(obj.data)
                bmesh.ops.dissolve_limit(bm, angle_limit=.001, verts=list(bm.verts),
                    edges=list(bm.edges), use_dissolve_boundaries=False, delimit={'MATERIAL'})
                bm.to_mesh(obj.data)
                bm.free()
            if lod == 2 and obj.data.materials[0].name == 'pal_' + paint:
                # One explicit split pass gives broad soot islands on the far
                # hood/roof, rather than tinting an entire sparse panel at once.
                refine(obj, .85, lambda p: p.z > low.z + .65 * H, passes=1)
            if obj.data.materials[0].name == 'pal_' + paint:
                # Large material soot islands remain legible even on the far
                # tier's sparse vertices; vertex tint feathers surviving paint.
                obj.data.materials.append(palette.mat('uiDark'))
                for face in obj.data.polygons:
                    c = face.center
                    if n3(c, 2.4, 3.3) > .06 or (c.z > low.z+.72*H and n3(c, 1.7, 6.1) > .05):
                        face.material_index = 1
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
        if asset == 'veh.sedan-white':
            for xb, xt in [(1.035, .46), (-1.48, -.95)]:
                for x, z in [(xb, 1.22), (xt, 1.745)]:
                    add('survivingScreenBorder', (x, 0, z), (.04, 1.66, .04))
                for y in (-.81, .81):
                    angle = math.atan2(xt-xb, .525)
                    add('survivingScreenBorder', ((xb+xt)/2, y, 1.4825),
                        (.04, .04, math.hypot(xt-xb, .525)), rot=(0, angle, 0))
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
            if lod == 0 and not wheel:
                bevel = obj.modifiers.new('nearSilhouetteBevel', 'BEVEL')
                bevel.width = .012
                bevel.segments = 1
                bevel.limit_method = 'ANGLE'
                bevel.angle_limit = .75
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
                    char = .12 + .85*patch
                    factor = tuple((1-char)*(1-hot*.32)*v for v in (1, .86, .76))
                else:
                    factor = (.37, .29, .25) if obj.data.materials[0].name == 'pal_sidewalk' else (.7, .65, .65)
                layer.data[loop.index].color = (*(c[k]*factor[k] for k in range(3)), 1)
            obj.data.calc_loop_triangles()
        triangles = sum(len(o.data.loop_triangles) for o in meshes)
        draws = sum(len(o.data.materials) for o in meshes)
        if triangles > [15000, 6000, 2000][lod] or draws > 8:
            raise ValueError(f'{asset} burned LOD{lod}: {triangles} tris, {draws} draws')
        # Restore semantic world transforms without moving authored geometry.
        # Set parents before children; protect wheel mesh world positions too.
        worlds = {o: o.matrix_world.copy() for o in meshes}
        def depth(obj):
            return 0 if obj.parent is None else 1 + depth(obj.parent)
        for obj in sorted(root.children_recursive + [root], key=depth):
            if obj.name in anchors:
                obj.matrix_world = anchors[obj.name]
                bpy.context.view_layer.update()
        for obj, world in worlds.items():
            obj.matrix_world = world
        path = directory / ('model.burned' + ('' if lod == 0 else '.lod'+str(lod)) + '.glb')
        export.glb(root, path)
        stats['lod'+str(lod)] = dict(triangles=triangles, draws=draws, materials=len({m.name for o in meshes for m in o.data.materials}), bytes=path.stat().st_size)
    stats_path.write_text(json.dumps(stats, indent=2)+'\n')
    supplied = directory / ('model.burned' + ('.lod'+str(tier) if tier else '') + '.glb')
    if supplied.resolve() != Path(output).resolve():
        shutil.copyfile(supplied, output)
