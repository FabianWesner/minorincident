"""Deterministic soft hedge: clustered leaf blobs over a rounded core.

LOD0 is a Poisson layout of lumpy leaf clumps (closed ellipsoids, hidden faces
culled) around a dark inset core, so colours change exactly where clumps meet.
Clump normals blend with the hedge's overall rounded form for soft shading; three
harmonious greens are assigned per clump (darker low, sunlit on the crown) and
baked Cycles AO darkens the creases. LOD1/LOD2 are authored from the same layout
as one coarse shell swelling over the clumps, banded skirt / sides / crown.
Run through tools/blender/run.py (factory startup, CPU Cycles).
"""
import argparse, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector, noise

parser = argparse.ArgumentParser()
parser.add_argument('--glb')
parser.add_argument('--lod1')
parser.add_argument('--lod2')
parser.add_argument('--quality', default='high')
parser.add_argument('--bake-ao', action='store_true')  # Cycles AO is always baked; flag reserves the runner's Cycles slot.
a = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

# Final bounds stay within the manifest contract: 2.53 x 0.88 (deep) x 1.56 m high.
HALF = Vector((.89, .04, 0))      # inner box half extents (x, y); rounding radius adds R
R = .20                            # rounding of the base form before clumps swell it
TOP = 1.36                         # base crown height before clumps
GREENS = [('foliageDark', '4a7533'), ('foliage', '7da23c'), ('foliageLight', '98b94f')]


def material(token, hex_color):
    rgb = [int(hex_color[i:i+2], 16)/255 for i in (0, 2, 4)]
    linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m = bpy.data.materials.new('pal_' + token)
    m.diffuse_color = (*linear, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*linear, 1)
    bs.inputs['Roughness'].default_value = .9
    return m


def base_point(q):
    """Map a point on the outer box to the rounded hedge form; returns (point, normal)."""
    inner = Vector((max(-HALF.x, min(HALF.x, q.x)), max(-HALF.y, min(HALF.y, q.y)), max(R, min(TOP - R, q.z))))
    d = q - inner
    if d.length < 1e-9:
        d = Vector((0, 0, 1))
    n = d.normalized()
    p = inner + n*R
    # A slightly domed crown and gently bellied sides read as a grown bush.
    p.z += .07*max(0, n.z)*(1 - (p.x/1.25)**2)
    p.y *= 1 + .07*math.sin(math.pi*min(1, p.z/TOP))
    return p, n


def clump_layout(seed=714):
    """Poisson-disk leaf clumps over the visible base form (no bottom)."""
    rng = random.Random(seed)
    clumps, tries = [], 0
    ox, oy, oz = HALF.x + R, HALF.y + R, TOP
    faces = [((-ox, ox), (-oy, oy), (oz, oz), 2.0), ((-ox, ox), (-oy, -oy), (0, oz), 3.6),
             ((-ox, ox), (oy, oy), (0, oz), 3.6), ((-ox, -ox), (-oy, oy), (0, oz), 1.3), ((ox, ox), (-oy, oy), (0, oz), 1.3)]
    weights = [f[3] for f in faces]
    while tries < 9000 and len(clumps) < 120:
        tries += 1
        fx, fy, fz, _ = rng.choices(faces, weights)[0]
        q = Vector((rng.uniform(*fx), rng.uniform(*fy), rng.uniform(*fz)))
        p, n = base_point(q)
        if p.z < .12:
            continue
        r = rng.uniform(.18, .35) * (.85 if p.z < .45 else 1)
        if all((p - c).length > .56*(r + cr) for c, cr, _, _ in clumps):
            # Sunlit crown clumps are lighter, the shaded skirt darker.
            light = n.z*.55 + p.z/TOP*.45 + rng.uniform(-.28, .28)
            shade = 2 if light > .6 else (0 if light < .28 else 1)
            clumps.append((p, r, n, shade))
    return clumps


def bump(p, clumps):
    """Soft maximum of hemispherical clump swellings; returns (height, dominant clump)."""
    k, total, best, best_h = .018, 0.0, 0, -1.0
    for i, (c, r, _, _) in enumerate(clumps):
        d = (p - c).length
        if d >= r:
            continue
        h = .62*r*math.sqrt(1 - (d/r)**2)
        total += math.exp(h/k)
        if h > best_h:
            best, best_h = i, h
    return (k*math.log(total) if total else 0.0), best


def make_objects(name, verts, faces, shades, form_normals, materials, blend):
    """One mesh per green; vertex normals blend the surface normal with the overall form."""
    objects = []
    for shade in range(3):
        fs = [f for f, sh in zip(faces, shades) if sh == shade]
        if not fs:
            continue
        used = sorted({i for f in fs for i in f})
        remap = {old: new for new, old in enumerate(used)}
        mesh = bpy.data.meshes.new(f'{name}_{GREENS[shade][0]}')
        mesh.from_pydata([verts[i] for i in used], [], [[remap[i] for i in f] for f in fs])
        mesh.update()
        mesh.shade_smooth()
        smooth = [Vector() for _ in used]
        for poly in mesh.polygons:
            for vi in poly.vertices:
                smooth[vi] += poly.normal*poly.area
        normals = [(sm.normalized()*(1 - blend) + form_normals[used[k]]*blend).normalized() for k, sm in enumerate(smooth)]
        mesh.normals_split_custom_set_from_vertices(normals)
        obj = bpy.data.objects.new('body' if shade == 1 else f'leaves_pal_{GREENS[shade][0]}', mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(materials[shade])
        mesh.color_attributes.new(name='ao', type='FLOAT_COLOR', domain='CORNER')
        objects.append(obj)
    return objects


def form_grid(step, swell):
    """Grid each outer-box face and project it to the rounded form (optionally swelling clumps)."""
    ox, oy, oz = HALF.x + R, HALF.y + R, TOP
    verts, normals, faces, index = [], [], [], {}

    def vertex(q):
        key = tuple(round(c, 5) for c in q)
        if key not in index:
            p, n = base_point(Vector(q))
            index[key] = len(verts)
            verts.append(swell(p, n))
            normals.append(n)
        return index[key]

    def grid(origin, du, dv, nu, nv):
        for i in range(nu):
            for j in range(nv):
                quad = [origin + du*(i/nu) + dv*(j/nv), origin + du*((i+1)/nu) + dv*(j/nv),
                        origin + du*((i+1)/nu) + dv*((j+1)/nv), origin + du*(i/nu) + dv*((j+1)/nv)]
                faces.append([vertex(tuple(v)) for v in quad])

    nx, ny, nz = (max(2, round(2*s/step)) for s in (ox, oy, oz/2))
    X, Y, Z = Vector((2*ox, 0, 0)), Vector((0, 2*oy, 0)), Vector((0, 0, oz))
    # Every grid winds outward (du x dv along the face normal): single-sided runtime materials.
    grid(Vector((-ox, -oy, oz)), X, Y, nx, ny)            # crown (+Z)
    grid(Vector((-ox, -oy, 0)), X, Z, nx, nz)             # front (-Y)
    grid(Vector((-ox, oy, 0)), Z, X, nz, nx)              # back (+Y)
    grid(Vector((-ox, -oy, 0)), Z, Y, nz, ny)             # left end (-X)
    grid(Vector((ox, -oy, 0)), Y, Z, ny, nz)              # right end (+X)
    for v in verts:  # tuck the skirt onto the lawn without a hard rim
        if v.z < .05:
            v.z = 0
    return verts, normals, faces


def build_lod(name, step, clumps, materials):
    """Coarse shell over the clump layout: dark skirt, mid sides, sunlit crown."""
    verts, normals, faces = form_grid(step, lambda p, n: p + n*bump(p, clumps)[0])
    shades = []
    for f in faces:
        nz = sum(normals[i].z for i in f)/len(f)
        z = sum(verts[i].z for i in f)/len(f)
        shades.append(2 if nz > .55 else (0 if z < .42 else 1))
    return make_objects(name, verts, faces, shades, normals, materials, .35)


def merge_clumps(clumps, count):
    """Agglomerate neighbouring clumps into fewer, larger blobs for the LOD1 tier."""
    merged = [list(c) for c in clumps]
    while len(merged) > count:
        i, j = min(((i, j) for i in range(len(merged)) for j in range(i + 1, len(merged))),
                   key=lambda ij: (merged[ij[0]][0] - merged[ij[1]][0]).length)
        (ca, ra, na, sa), (cb, rb, nb, sb) = merged[i], merged[j]
        wa, wb = ra**3, rb**3
        merged[i] = [(ca*wa + cb*wb)/(wa + wb), 1.08*(wa + wb)**(1/3), (na*wa + nb*wb).normalized(), sa if ra >= rb else sb]
        del merged[j]
    return [tuple(c) for c in merged]


def build_clumps(name, clumps, materials, seg=12, rings=9, core_step=.2):
    """Lumpy leaf clumps around an inset core; faces hidden inside neighbours are culled."""
    verts, normals, faces, shades = [], [], [], []
    frames = []
    for c, r, n, shade in clumps:
        t = n.cross(Vector((0, 0, 1)) if abs(n.z) < .9 else Vector((1, 0, 0))).normalized()
        frames.append((c - n*.16*r, r, .78*r, n, t, n.cross(t)))
    def inside(p, skip):
        for k, (o, r, h, n, t, b) in enumerate(frames):
            if k == skip:
                continue
            d = p - o
            if (d.dot(t)/r)**2 + (d.dot(b)/r)**2 + (d.dot(n)/h)**2 < .94:
                return True
        return False
    core_verts, core_normals, core_faces = form_grid(core_step, lambda p, n: p - n*.03)
    for k, ((o, r, h, n, t, b), (_, _, _, shade)) in enumerate(zip(frames, clumps)):
        ring_index = []
        for i in range(rings + 1):
            theta = math.pi*i/rings
            row = []
            for j in range(seg if 0 < i < rings else 1):
                phi = 2*math.pi*j/seg
                u = Vector((math.sin(theta)*math.cos(phi), math.sin(theta)*math.sin(phi), math.cos(theta)))
                p = o + t*u.x*r + b*u.y*r + n*u.z*h
                # Leafy lumps: low-frequency noise keeps the outline soft, not spiky.
                p += (p - o).normalized()*r*(.08*noise.noise(p*6.0 + Vector((k, 0, 0))) + .05*noise.noise(p*17.0))
                row.append(len(verts))
                verts.append(p)
                normals.append(n)
            ring_index.append(row)
        for i in range(rings):
            top, bottom = ring_index[i], ring_index[i + 1]
            for j in range(seg):
                # theta runs from +n to -n and phi turns t -> b, so theta x phi points outward.
                if len(top) == 1:
                    f = [top[0], bottom[j], bottom[(j + 1) % seg]]
                elif len(bottom) == 1:
                    f = [top[j], bottom[0], top[(j + 1) % seg]]
                else:
                    f = [top[j], bottom[j], bottom[(j + 1) % seg], top[(j + 1) % seg]]
                if all(verts[v].z < .005 or inside(verts[v], k) for v in f):
                    continue
                faces.append(f)
                shades.append(shade)
    base = len(verts)
    verts += core_verts
    normals += core_normals
    for f in core_faces:
        if all(inside(core_verts[v], -1) for v in f):
            continue
        faces.append([v + base for v in f])
        shades.append(0)
    for v in verts:
        v.z = max(0, v.z)
    return make_objects(name, verts, faces, shades, normals, materials, .4)


def bake_ao(objects):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.render.bake.target = 'VERTEX_COLORS'
    for obj in objects:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        obj.data.color_attributes.active_color = obj.data.color_attributes['ao']
        bpy.ops.object.bake(type='AO')
    # Lift the floor of the bake: creases read as depth, not as black holes.
    for obj in objects:
        data = obj.data.color_attributes['ao'].data
        for item in data:
            v = .38 + .62*item.color[0]
            item.color = (v, v, v, 1)


def export(path, objects, root, col):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root, col] + objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(path).resolve()), export_format='GLB', use_selection=True,
                              export_yup=True, export_extras=True, export_cameras=False, export_lights=False)


clumps = clump_layout()
tiers = [('model', .048, a.glb), ('lod1', .16, a.lod1), ('lod2', .34, a.lod2)]
for tier, step, path in tiers:
    if path is None and tier != 'model':
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials = [material(token, color) for token, color in GREENS]
    root = bpy.data.objects.new('root', None)
    bpy.context.collection.objects.link(root)
    root['asset_id'] = 'prop.hedge'
    root['category'] = 'prop'
    if tier == 'model':
        objects = build_clumps(tier, clumps, materials)
    elif tier == 'lod1':
        objects = build_clumps(tier, merge_clumps(clumps, 26), materials, 8, 6, .3)
    else:
        objects = build_lod(tier, step, clumps, materials)
    for obj in objects:
        obj.parent = root
    col = bpy.data.objects.new('col:hedge', None)
    bpy.context.collection.objects.link(col)
    col.parent = root
    col.location = (0, 0, .75)
    col['collider'] = 'cuboid'
    col['size'] = [2.4, .84, 1.5]
    if tier == 'model':
        fit = [max(abs((o.matrix_world @ v.co)[k]) for o in objects for v in o.data.vertices) for k in range(2)] + \
              [max((o.matrix_world @ v.co).z for o in objects for v in o.data.vertices)]
    else:
        # Lower tiers keep LOD0's exact footprint and height (no pop, same collider).
        own = [max(abs(v.co[k]) for o in objects for v in o.data.vertices) for k in range(2)] + \
              [max(v.co.z for o in objects for v in o.data.vertices)]
        for o in objects:
            for v in o.data.vertices:
                v.co = Vector((v.co.x*fit[0]/own[0], v.co.y*fit[1]/own[1], v.co.z*fit[2]/own[2]))
    bake_ao(objects)
    tris = sum(len(p.vertices) - 2 for o in objects for p in o.data.polygons)
    bounds = [(min((o.matrix_world @ v.co)[k] for o in objects for v in o.data.vertices),
               max((o.matrix_world @ v.co)[k] for o in objects for v in o.data.vertices)) for k in range(3)]
    print(f'OK hedge {tier}: clumps {len(clumps)} triangles {tris} size',
          [round(hi - lo, 3) for lo, hi in bounds])
    if path:
        export(path, objects, root, col)
