"""L3 traffic wrecks, derived from the intact vehicle's own native LOD meshes.

Every wreck starts from the base model's closed native LOD1 (near/mid) or LOD2
(far) so silhouette, wheels, lamps, livery and anchors match the intact car.
Damage is authored on top: smoothly crumpled front, torn hood, shattered glass
with dark holes, an opened impact-side door, a flat front tyre, dents, rust and
soot (vertex tint). No decimation and no AABB fitting. Draw calls stay low
because wheels use one tinted material and the body one material per livery
colour.
"""
import json
import math
import shutil
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix, Vector, noise
from . import palette, sockets, export, ao

# keep: body palette tokens that survive (each is one draw); shard: glass remnant
# token; open: door owners swung open on the impact (-Y) side {owner: degrees};
# cr/roof: crush and roof sag strength.
CFG = {
    'veh.sedan-white': dict(paint='picketWhite', keep=['picketWhite', 'sidewalk', 'uiDark'], shard='sidewalk',
                            open={'doorL': 30}, cr=1.0, roof=.10),
    'veh.suv-dark': dict(paint='asphalt', keep=['asphalt', 'sidewalk', 'brick', 'uiDark'], shard='sidewalk',
                         open={'doorL': 30}, cr=.9, roof=.12,
                         alias={'woodWarm': 'brick', 'schoolBusYellow': 'sidewalk'}),
    'veh.pickup-red': dict(paint='survivorRed', keep=['survivorRed', 'picketWhite', 'sidewalk', 'uiDark'], shard='sidewalk',
                           open={'doorL': 30}, cr=1.0, roof=.12, alias={'blood': 'survivorRed'}),
    'veh.ambulance': dict(paint='picketWhite', keep=['picketWhite', 'survivorRed', 'policeBlue', 'uiDark'], shard='picketWhite',
                          open={'doorL': 38}, cr=.8, roof=.07, alias={'sidewalk': 'uiDark'}),
    'veh.school-bus': dict(paint='schoolBusYellow', keep=['schoolBusYellow', 'survivorRed', 'sidewalk', 'uiDark'], shard='sidewalk',
                           open={'door_near_0': -38, 'door_near_1': -38}, cr=.85, roof=.10),
}
WHEELS = ('wheelFL', 'wheelFR', 'wheelRL', 'wheelRR')
LIMITS = [15000, 6000, 2000]
RUST = (1.0, .52, .30)


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def n3(p, s, o=0.0):
    return noise.noise(Vector((p[0] * s + o, p[1] * s + o * .7, p[2] * s - o * .3)))


def refine(obj, limit, zone=None, passes=3):
    """Split edges longer than `limit` inside `zone(world_point)`; welds stay conforming."""
    for _ in range(passes):
        bm = bmesh.new(); bm.from_mesh(obj.data)
        edges = [e for e in bm.edges if e.calc_length() > limit and
                 (zone is None or zone((e.verts[0].co + e.verts[1].co) / 2))]
        if not edges:
            bm.free(); break
        bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data); bm.free()


def box(name, center, size, token, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(rot[2], 3, 'Z') @ Matrix.Rotation(rot[1], 3, 'Y') @ Matrix.Rotation(rot[0], 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector(center))
    mesh = bpy.data.meshes.new(name); bm.to_mesh(mesh); bm.free()
    mesh.materials.append(palette.mat(token))
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build_wreck(directory, output):
    directory = Path(directory)
    asset = directory.name
    cfg = CFG[asset]
    requested_tier = int(sys.argv[sys.argv.index('--distance-tier') + 1]) if '--distance-tier' in sys.argv else None
    if requested_tier not in (None, 1, 2):
        raise ValueError('distance tier must be 1 or 2')
    stats_path = directory / 'wrecked-stats.json'
    stats = json.loads(stats_path.read_text()) if stats_path.exists() else {}
    for lod in ((requested_tier,) if requested_tier is not None else (0, 1, 2)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(directory / ('model.lod2.glb' if lod == 2 else 'model.lod1.glb')))
        bpy.context.view_layer.update()
        root = bpy.data.objects[asset]
        meshes = [o for o in root.children_recursive if o.type == 'MESH']
        pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
        low = Vector(tuple(min(v[k] for v in pts) for k in range(3)))
        high = Vector(tuple(max(v[k] for v in pts) for k in range(3)))
        L, W, H = high.x - low.x, high.y - low.y, high.z - low.z
        nose, top, base = high.x, high.z, low.z
        K = min(L, 5.2)

        # --- classify (before geometry is baked to world space) -------------
        info = {}
        for obj in meshes:
            anc = []
            p = obj.parent
            while p:
                anc.append(p.name); p = p.parent
            mats = [m.name.removeprefix('pal_').removeprefix('emi_').split('.')[0] for m in obj.data.materials]
            emissive = any(m.name.startswith('emi_') for m in obj.data.materials)
            wheel = next((a for a in anc if a in WHEELS), None)
            glass = (not wheel) and ('glass' in obj.name.lower() or 'windshield' in obj.name.lower() or 'backpackTeal' in mats
                                     or (mats == ['asphalt'] and asset != 'veh.suv-dark' and sum((obj.matrix_world @ v.co).z for v in obj.data.vertices) / len(obj.data.vertices) > base + .38 * H))
            door = next((a for a in anc if a in cfg['open']), None)
            info[obj] = dict(wheel=wheel, glass=glass, door=door, emissive=emissive, mats=mats)
        pivots = {n: bpy.data.objects[n].matrix_world.translation.copy() for n in cfg['open'] if n in bpy.data.objects}
        # flat tyre: front wheel on the impact (-Y) side
        flat = min((w for w in WHEELS if w in bpy.data.objects),
                   key=lambda w: (-(bpy.data.objects[w].matrix_world.translation.x > 0), bpy.data.objects[w].matrix_world.translation.y))

        # --- bake to world space, detach from the hierarchy ------------------
        sideways = [o for o in meshes]

        def door_matrix(name, deg):
            pv = pivots[name]
            a = math.radians(deg)
            return Matrix.Translation(pv) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(math.radians(5 * (1 if a > 0 else -1)), 4, 'Y') \
                @ Matrix.Translation(-pv + Vector((0, 0, -.12)))

        # open each door as far as the intact footprint allows (dimension contract +-10 %)
        angles = {}
        for name, deg in cfg['open'].items():
            members = [o for o in sideways if info[o]['door'] == name]
            for trial in range(int(abs(deg)), 4, -2):
                a = math.copysign(trial, deg)
                mm = door_matrix(name, a)
                ys = [(mm @ o.matrix_world @ v.co).y for o in members for v in o.data.vertices]
                if min(ys) >= low.y - .045 * W and max(ys) <= high.y + .045 * W:
                    angles[name] = a; break
            angles.setdefault(name, 6.0 * (1 if deg > 0 else -1))
        for obj in sideways:
            mw = obj.matrix_world.copy()
            i = info[obj]
            if i['door']:
                mw = door_matrix(i['door'], angles[i['door']]) @ mw
            obj.data.transform(mw)
            obj.parent = None
            obj.matrix_world = Matrix.Identity(4)
            obj.data.update()

        body = bpy.data.objects.get('body')
        if body is None or body.type == 'MESH':
            if body is not None:
                body.name = 'originalBody'
            body = sockets.empty('body', parent=root)

        # --- remove glass (kept as shards), map materials --------------------
        glass_pts = []
        for obj in list(sideways):
            i = info[obj]
            if i['glass']:
                glass_pts += [v.co.copy() for v in obj.data.vertices]
                refine(obj, .30 if lod == 0 else .55, passes=2)
                bm = bmesh.new(); bm.from_mesh(obj.data)
                kill = []
                for f in bm.faces:
                    c = f.calc_center_median()
                    keep = n3(c, 5.5, 3.1) > .12 or (lod < 2 and n3(c, 11, 1.7) > .38)
                    if not keep:
                        kill.append(f)
                bmesh.ops.delete(bm, geom=kill, context='FACES')
                bm.to_mesh(obj.data); bm.free()
                obj.data.materials.clear(); obj.data.materials.append(palette.mat(cfg['shard']))
                i['shard'] = True
        keep = set(cfg['keep'])
        alias = cfg.get('alias', {})
        for obj in sideways:
            i = info[obj]
            if i.get('shard'):
                continue
            if i['wheel']:
                obj.data.materials.clear(); obj.data.materials.append(palette.mat('sidewalk'))
                continue
            for k, m in enumerate(list(obj.data.materials)):
                token = m.name.removeprefix('pal_').removeprefix('emi_').split('.')[0]
                if m.name.startswith('emi_'):   # every lens is dead
                    token = {'sirenRed': 'survivorRed', 'policeBlue': 'policeBlue'}.get(token, 'uiDark')
                token = alias.get(token, token)
                obj.data.materials[k] = palette.mat(token if token in keep else 'uiDark')

        # --- damage ----------------------------------------------------------
        cr = cfg['cr']
        yimp = -.22 * W
        u0 = nose - .32 * K

        def deform(p, wheel=False):
            x, y, z = p
            rel = (z - base) / H
            if wheel:
                return p
            u = max(0.0, min(1.0, (x - u0) / (.32 * K)))
            s = u * u * (3 - 2 * u)
            g = math.exp(-(((y - yimp) / (.50 * W)) ** 2))
            zlow = .45 + .55 * smooth(.05, .35, rel)
            dx = -(.045 * K * s + .105 * K * s * g * (.55 + .45 * zlow)) * cr
            dx += .02 * K * s * n3(p, 7, 2.0)
            dz = .0
            dy = .04 * W * s
            if rel > .28:   # bonnet / fender region folds up then falls off
                dz += .20 * cr * s * g * math.sin(u * math.pi * 1.35) * smooth(.28, .5, rel) * min(1.0, 2.2 / H)
                dz -= .14 * cr * s * g * smooth(.45, 1.0, rel) * min(1.0, 2.0 / H)
            else:           # bumper and valance drop
                dz -= .09 * cr * s * (.4 + g)
            # tilt toward the flat front-left corner
            dz -= .10 * smooth(-.1 * L, nose, x) * smooth(-.1 * W, -.5 * W, y)
            # roof buckle
            if rel > .78:
                ex = math.exp(-(((x - (-.02 * L)) / (.30 * L)) ** 2))
                dz -= cfg['roof'] * ex * (1 - .5 * abs(y) / (W / 2)) * (1.4 + .5 * n3(p, 3, 1.3))
            # driver side dents
            if y < -.30 * W:
                d = math.exp(-(((x - .05 * L) / (.24 * L)) ** 2)) * math.exp(-(((rel - .5) / .28) ** 2))
                dy += .06 * d * (1 + .6 * n3(p, 6, 4.0))
            # rear shunt
            e = smooth(low.x + .16 * K, low.x, x)
            dx += .05 * K * e * (.5 + .5 * n3(p, 4, 9)) * cr
            # broad panel waviness
            dn = .028 * n3(p, 5.0, 5.5)
            return Vector((x + dx + dn, y + dy + dn * .6, z + dz + dn * .5))

        zone_front = lambda p: p[0] > u0 - .05
        for obj in sideways:
            i = info[obj]
            if i['wheel'] or i['emissive']:
                continue
            if lod < 2:
                refine(obj, .34 if lod == 0 else .62, zone_front, passes=3 if lod == 0 else 2)
                if lod == 0:
                    refine(obj, .9, None, passes=2)
            for v in obj.data.vertices:
                v.co = deform(v.co)
            obj.data.update()

        # flat front tyre: squash toward the ground, sag the rim
        fx, fy = bpy.data.objects[flat].matrix_world.translation.x, bpy.data.objects[flat].matrix_world.translation.y
        for obj in sideways:
            i = info[obj]
            if i['wheel'] == flat:
                for v in obj.data.vertices:
                    v.co.z = base + (v.co.z - base) * .62 - .02
                    v.co.x += .05
                obj.data.update()
            elif i['wheel']:
                continue

        # --- hood tear and engine bay ---------------------------------------
        hx0, hx1 = nose - .30 * K, nose - .07 * K
        paint_z = [v.co.z for o in sideways for v in o.data.vertices if not info[o]['wheel'] and hx0 < v.co.x < hx1 and abs(v.co.y) < .3 * W and v.co.z > base + .45 * H * .6]
        if paint_z and lod < 2:
            zh = max(paint_z)
            for obj in sideways:
                i = info[obj]
                if i['wheel'] or i['glass'] or i['emissive'] or 'pal_' + cfg['paint'] not in [m.name for m in obj.data.materials]:
                    continue
                bm = bmesh.new(); bm.from_mesh(obj.data)
                kill = [f for f in bm.faces if f.normal.z > .55 and hx0 < f.calc_center_median().x < hx1 and
                        yimp - .20 * W < f.calc_center_median().y < yimp + .38 * W and f.calc_center_median().z > zh - .22 and
                        n3(f.calc_center_median(), 4.5, 6.0) > -.18]
                bmesh.ops.delete(bm, geom=kill, context='FACES')
                bm.to_mesh(obj.data); bm.free()
            eng = box('engineBay', ((hx0 + hx1) / 2 - .05, yimp * .6, zh - .30 - .12 * H), ((hx1 - hx0) * .95, .40 * W, .26), 'uiDark')
            block = box('engineBlock', ((hx0 + hx1) / 2 + .1, yimp * .6, zh - .20 - .12 * H), ((hx1 - hx0) * .5, .22 * W, .16), 'sidewalk' if 'sidewalk' in keep else 'uiDark', (0, 0, .3))
            sideways += [eng, block]
            info[eng] = dict(wheel=None, glass=False, door=None, emissive=False, mats=[])
            info[block] = dict(wheel=None, glass=False, door=None, emissive=False, mats=[])

        # --- dark cabin interior so open glass reads as holes ----------------
        if glass_pts:
            gx = [p.x for p in glass_pts]; gy = [p.y for p in glass_pts]; gz = [p.z for p in glass_pts]
            zt = max(gz) - .30 - cfg['roof']
            zb = min(gz) - .35
            cab = box('cabinInterior', ((min(gx) + max(gx)) / 2, 0, (zt + zb) / 2),
                      ((max(gx) - min(gx)) * .80, (max(gy) - min(gy)) * .62, zt - zb), 'uiDark')
            sideways.append(cab)
            info[cab] = dict(wheel=None, glass=False, door=None, emissive=False, mats=[])

        # --- debris -----------------------------------------------------------
        if lod < 2:
            for k in range(4 if lod == 0 else 2):
                piece = box('debris%d' % k, (nose - .55 * K + k * .22, -W * .36 - .05 * k, base + .05), (.16, .09, .05), 'uiDark' if k % 2 else cfg['paint'], (0, 0, .6 * k))
                sideways.append(piece); info[piece] = dict(wheel=None, glass=False, door=None, emissive=False, mats=[])

        # --- re-parent: wheels to their pivots, everything else to body ------
        for obj in sideways:
            i = info[obj]
            owner = bpy.data.objects[i['wheel']] if i['wheel'] else body
            obj.parent = owner
            obj.matrix_parent_inverse = owner.matrix_world.inverted()
        for obj in root.children_recursive:
            if 'ss_light' in obj:
                del obj['ss_light']
                obj['wreckLightOff'] = True
        if bpy.data.objects.get('front') is None:
            sockets.empty('front', (nose, 0, top * .5), root)
        root['decay'] = 'wrecked'
        root['ss_physics'] = json.dumps({
            'class': 'heavy', 'mass': 1900 if asset in ('veh.ambulance', 'veh.school-bus') else 1400,
            'friction': .85, 'restitution': .02, 'centerOfMass': [0, .6, 0],
            'pushable': False, 'kickable': False, 'flammable': True, 'sounds': 'prop.metal-heavy'})

        export.merge_by_material(root, set(WHEELS) | {'body'})
        meshes = [o for o in root.children_recursive if o.type == 'MESH']
        for obj in meshes:
            bm = bmesh.new(); bm.from_mesh(obj.data); bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(obj.data); bm.free()
        bpy.context.view_layer.update()
        ao.bake_all(meshes, 16)

        # --- tint: tyres/rims, rust, soot, grime (exported as vertex colour) ---
        for obj in meshes:
            layer = obj.data.color_attributes.active_color
            wheel = obj.parent is not None and obj.parent.name in WHEELS
            radius = max(math.hypot(v.co.x, v.co.z) for v in obj.data.vertices) if wheel else 1
            is_paint = obj.data.materials[0].name == 'pal_' + cfg['paint']
            for loop in obj.data.loops:
                co = obj.data.vertices[loop.vertex_index].co
                w = obj.matrix_world @ co
                c = layer.data[loop.index].color
                r, g, b = c[0], c[1], c[2]
                if wheel:
                    rim = math.hypot(co.x, co.z) < .64 * radius
                    f = (.62, .60, .64) if rim else (.045, .042, .06)
                    r, g, b = r * f[0], g * f[1], b * f[2]
                else:
                    dirt = .80 + .20 * smooth(-.3, .5, n3(w, 2.2, 8.0))
                    sill = smooth(base + .75, base + .30, w.z)
                    patch = smooth(.04, .34, n3(w, 3.4, 11.0) + .35 * sill + .10 * (w.x > nose - .5 * K))
                    if is_paint:
                        rr = patch * 1.0
                        r *= (1 - rr) + RUST[0] * rr; g *= (1 - rr) + RUST[1] * rr; b *= (1 - rr) + RUST[2] * rr
                    r, g, b = r * dirt, g * dirt, b * dirt
                    t = math.exp(-(((w.x - (nose - .22 * K)) / (.22 * K)) ** 2)) * smooth(base + .45, base + .8, w.z) * (.65 + .35 * n3(w, 4, 2.0))
                    # scorch along the bonnet and a dark streak above the torn engine bay
                    sc = .62 * t
                    r, g, b = r * (1 - sc), g * (1 - sc), b * (1 - sc)
                layer.data[loop.index].color = (r, g, b, 1)
            obj.data.calc_loop_triangles()
        triangles = sum(len(o.data.loop_triangles) for o in meshes)
        draws = sum(len(o.data.materials) for o in meshes)
        if triangles > LIMITS[lod] or draws > 8:
            raise ValueError(f'{asset} LOD{lod}: {triangles} tris, {draws} draws')
        path = directory / ('model.wrecked' + ('' if lod == 0 else '.lod' + str(lod)) + '.glb')
        export.glb(root, path)
        stats['lod' + str(lod)] = {'triangles': triangles, 'draws': draws, 'bytes': path.stat().st_size}
    (directory / 'wrecked-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
    supplied = directory / ('model.wrecked' + ('.lod' + str(requested_tier) if requested_tier else '') + '.glb')
    if supplied.resolve() != Path(output).resolve():
        shutil.copyfile(supplied, output)
