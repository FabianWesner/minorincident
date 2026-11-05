"""Clean low-poly toolkit for the Alpha and Mega Alpha rebuild (2026-10-22, concept drafts in assets/inf.alpha/concepts).

Every primitive is its own closed solid (loft / faceted blob / block / spike / extruded flap), authored directly in rest-pose
world coordinates and owned by one rigid joint. No voxel union, no boolean, no subdivision: faceted flat shading like the
approved style references. A primitive carries `lodmax` (the highest LOD index it still appears in) and is reduced per
primitive with the Blender collapse decimator at the distant tiers, so a closed solid stays closed.

Rig: `rig_*.json` hold the joint world positions that the shipped assets already use (frozen from the previous GLBs), so
the node names, hierarchy, identity rest rotations and animation retargeting are unchanged.
"""
import json
import math
import random
import zlib
import bmesh
import bpy
from mathutils import Matrix, Vector

Z = Vector((0, 0, 1))
X = Vector((1, 0, 0))


class Kit:
    def __init__(self, palette, seed=7):
        self.palette = palette
        self.prims = []
        self.mats = {}
        self.rng = random.Random(seed)
        self.xf = Matrix.Identity(4)   # optional frame (e.g. the leaning torso) applied to every primitive added while set

    # -- materials ---------------------------------------------------------------------------------------------------
    def mat(self, token):
        """Palette material `pal_<token>` (the runtime resolves palette names); `eye` is the emissive infectedEye."""
        if token == 'eye':
            token, emit = 'infectedEye', True
        else:
            emit = False
        key = ('emi_' if emit else 'pal_') + token
        if key not in self.mats:
            m = bpy.data.materials.new(key)
            m.use_nodes = True
            h = self.palette[token][1:]
            c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
            c = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c] + [1]
            b = m.node_tree.nodes.get('Principled BSDF')
            b.inputs['Base Color'].default_value = c
            b.inputs['Roughness'].default_value = .62 if emit else .78
            if emit:
                b.inputs['Emission Color'].default_value = c
                b.inputs['Emission Strength'].default_value = 2.5
            m.diffuse_color = c
            self.mats[key] = m
        return self.mats[key]

    # -- raw add -----------------------------------------------------------------------------------------------------
    def add(self, name, owner, mat, verts, faces, lodmax=2, keep=False, flat=True, mirror=False):
        xf = self.xf
        v = [xf @ Vector(p) for p in verts]
        self.prims.append(dict(name=name, owner=owner, mat=mat, verts=v, faces=[tuple(f) for f in faces], lodmax=lodmax, keep=keep))
        return self.prims[-1]

    def mirrored(self, fn, *a, **k):
        """Call fn(side, *a, **k) for the left (+Y) and right (-Y) side."""
        for s in (1, -1):
            fn(s, *a, **k)

    # -- primitives --------------------------------------------------------------------------------------------------
    def loft(self, name, owner, mat, secs, N=8, caps=(True, True), jitter=.05, ref=Z, lodmax=2, rot=0.0, keep=False):
        """Closed tube through `secs`: each section (centre, (half-width along u, half-depth along w)[, roll]).
        Faces are n-gons, so an 8-sided loft of 3 sections is 16 quads + 2 octagons (8+16... triangulated below)."""
        rng = random.Random(zlib.crc32(name.encode()))
        pts = [Vector(s[0]) for s in secs]
        verts, faces = [], []
        for j, s in enumerate(secs):
            c = pts[j]
            t = (pts[min(j + 1, len(pts) - 1)] - pts[max(j - 1, 0)]).normalized()
            r = ref if abs(t.dot(ref)) < .92 else X
            u = r.cross(t).normalized()
            w = t.cross(u).normalized()
            ru, rw = s[1]
            roll = s[2] if len(s) > 2 else 0
            for i in range(N):
                a = rot + roll + 2 * math.pi * i / N
                k = 1 + rng.uniform(-jitter, jitter)
                verts.append(c + (u * math.cos(a) * ru + w * math.sin(a) * rw) * k)
        for j in range(len(secs) - 1):
            for i in range(N):
                a, b = j * N + i, j * N + (i + 1) % N
                faces.append((a, b, b + N, a + N))
        if caps[0]:
            faces.append(tuple(range(N - 1, -1, -1)))
        if caps[1]:
            faces.append(tuple((len(secs) - 1) * N + i for i in range(N)))
        return self.add(name, owner, mat, verts, faces, lodmax, keep)

    def blob(self, name, owner, mat, c, radii, rot=(0, 0, 0), sub=2, jitter=.08, lodmax=2, keep=False, squash=None):
        """Faceted ellipsoid (icosphere with a per-vertex radial jitter). `sub` 1 = 20 tris, 2 = 80 tris, 3 = 320 tris."""
        rng = random.Random(zlib.crc32(name.encode()))
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
        m = Matrix.Translation(Vector(c)) @ _euler(rot) @ Matrix.Diagonal(Vector((*radii, 1)))
        verts = []
        for v in bm.verts:
            k = 1 + rng.uniform(-jitter, jitter)
            verts.append(m @ (v.co * k))
        faces = [tuple(v.index for v in f.verts) for f in bm.faces]
        bm.free()
        return self.add(name, owner, mat, verts, faces, lodmax, keep)

    def block(self, name, owner, mat, c, size, rot=(0, 0, 0), taper=(1, 1), shear=(0, 0), jitter=.0, lodmax=2, keep=False):
        """Hexahedron: `size` full extents, `taper` scales the top (z+) face in x and y, `shear` shifts it."""
        rng = random.Random(zlib.crc32(name.encode()))
        sx, sy, sz = size
        m = Matrix.Translation(Vector(c)) @ _euler(rot)
        verts = []
        for dz in (-.5, .5):
            tx, ty = (taper if dz > 0 else (1, 1))
            for dx, dy in ((-.5, -.5), (.5, -.5), (.5, .5), (-.5, .5)):
                p = Vector((dx * sx * tx + (shear[0] * sx if dz > 0 else 0), dy * sy * ty + (shear[1] * sy if dz > 0 else 0), dz * sz))
                p = p * (1 + rng.uniform(-jitter, jitter))
                verts.append(m @ p)
        faces = [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        return self.add(name, owner, mat, verts, faces, lodmax, keep)

    def cone(self, name, owner, mat, base, direction, r, length, N=5, tip=.05, lodmax=2, keep=False, rr=None):
        """Spike/horn/claw: a closed frustum from `base` along `direction`; `rr` = (rx, ry) for an oval base."""
        d = Vector(direction).normalized()
        ref = Z if abs(d.dot(Z)) < .92 else X
        u = ref.cross(d).normalized()
        w = d.cross(u).normalized()
        rx, ry = rr if rr else (r, r)
        verts = []
        for i in range(N):
            a = 2 * math.pi * i / N
            verts.append(Vector(base) + u * math.cos(a) * rx + w * math.sin(a) * ry)
        for i in range(N):
            a = 2 * math.pi * i / N
            verts.append(Vector(base) + d * length + u * math.cos(a) * rx * tip + w * math.sin(a) * ry * tip)
        faces = [tuple(range(N - 1, -1, -1)), tuple(N + i for i in range(N))]
        for i in range(N):
            a, b = i, (i + 1) % N
            faces.append((a, b, b + N, a + N))
        return self.add(name, owner, mat, verts, faces, lodmax, keep)

    def flap(self, name, owner, mat, pts, thick, normal, lodmax=2, keep=False):
        """A thin closed prism: the polygon `pts` (a torn cloth tongue) extruded `thick` along `normal`."""
        n = Vector(normal).normalized() * thick
        N = len(pts)
        verts = [Vector(p) for p in pts] + [Vector(p) + n for p in pts]
        faces = [tuple(range(N - 1, -1, -1)), tuple(N + i for i in range(N))]
        for i in range(N):
            a, b = i, (i + 1) % N
            faces.append((a, b, b + N, a + N))
        return self.add(name, owner, mat, verts, faces, lodmax, keep)


def _euler(rot):
    if isinstance(rot, Matrix):
        return rot.to_4x4()
    return Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X')


def aim(direction, roll=0.0):
    """A rotation matrix whose +Z points along `direction` (blobs and blocks are authored z-up)."""
    d = Vector(direction).normalized()
    q = Z.rotation_difference(d)
    return (q.to_matrix().to_4x4()) @ Matrix.Rotation(roll, 4, 'Z')


def frame(origin, lean):
    """Rotation about +Y (positive lean tips +Z toward +X) around `origin`."""
    return Matrix.Translation(Vector(origin)) @ Matrix.Rotation(lean, 4, 'Y')


# -- realise ---------------------------------------------------------------------------------------------------------
def tri_count(obj):
    return sum(len(f.vertices) - 2 for f in obj.data.polygons)


def _object(kit, prim, mat_obj):
    mesh = bpy.data.meshes.new(prim['name'])
    mesh.from_pydata([tuple(v) for v in prim['verts']], [], prim['faces'])
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method='SHORT_EDGE', ngon_method='EAR_CLIP')
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat_obj)
    for p in mesh.polygons:
        p.use_smooth = False
    o = bpy.data.objects.new(prim['name'], mesh)
    bpy.context.scene.collection.objects.link(o)
    return o


def reduce(obj, ratio):
    if ratio >= .999:
        return
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('reduce', 'DECIMATE')
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=list(bm.edges))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    for p in obj.data.polygons:
        p.use_smooth = False


def is_closed(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    ok = all(len(e.link_faces) % 2 == 0 and len(e.link_faces) >= 2 for e in bm.edges)
    bm.free()
    return ok


def realise(kit, lod, target, owners, minimum=10, small=24):
    """Per-owner joined meshes for one LOD. Primitives above `lodmax` are dropped; the rest are collapse-reduced by one
    shared ratio (found by bisection) so the total lands on `target` triangles. `keep` primitives (eyes) stay untouched.
    Returns {owner: object}."""
    small = 24 if lod < 2 else 12
    pieces = []
    for prim in kit.prims:
        if prim['lodmax'] < lod:
            continue
        pieces.append((prim, _object(kit, prim, kit.mat(prim['mat']))))
    sources = {id(o): o.data.copy() for _, o in pieces}
    keep_tris = sum(tri_count(o) for p, o in pieces if p['keep'])
    total0 = sum(len(sources[id(o)].polygons) for _, o in pieces)
    if total0 <= target:
        ratio = 1.0
    else:
        lo, hi = .02, 1.0
        # bisection on the estimated total: each reducible piece keeps max(minimum, ratio * tris) triangles
        def estimate(r):
            total = keep_tris
            for p, o in pieces:
                if p['keep']:
                    continue
                n = len(sources[id(o)].polygons)
                total += n if n <= small else max(min(n, minimum), int(n * r))
            return total
        for _ in range(30):
            mid = (lo + hi) / 2
            if estimate(mid) > target:
                hi = mid
            else:
                lo = mid
        ratio = lo
    for p, o in pieces:
        if p['keep'] or ratio >= 1.0:
            continue
        n = len(o.data.polygons)
        if n <= small:
            continue
        want = max(min(n, minimum), int(n * ratio))
        reduce(o, want / n)
    by_owner = {}
    for p, o in pieces:
        by_owner.setdefault(p['owner'], []).append(o)
    joined = {}
    for owner, objs in by_owner.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        o = objs[0]
        o.name = owner + '__alpha'
        # compact duplicate material slots created by the join
        slots = list(o.data.materials)
        unique = list(dict.fromkeys(slots))
        idx = [unique.index(slots[f.material_index]) for f in o.data.polygons]
        o.data.materials.clear()
        for m in unique:
            o.data.materials.append(m)
        for f, i in zip(o.data.polygons, idx):
            f.material_index = i
        for f in o.data.polygons:
            f.use_smooth = False
        joined[owner] = o
    return joined, sum(tri_count(o) for o in joined.values())


def make_rig(rig):
    """Empties with the shipped names, hierarchy and world positions; rotations identity, scales one."""
    nodes = {}
    for name, d in rig['nodes'].items():
        o = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(o)
        o.location = Vector(d['world'])
        nodes[name] = o
    bpy.context.view_layer.update()
    for name, d in rig['nodes'].items():
        if d['parent']:
            nodes[name].parent = nodes[d['parent']]
            nodes[name].matrix_parent_inverse = Matrix.Identity(4)
            nodes[name].location = Vector(d['world']) - Vector(rig['nodes'][d['parent']]['world'])
    bpy.context.view_layer.update()
    return nodes


def attach(obj, parent):
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()
    obj.matrix_basis = Matrix.Identity(4)


def stump_cap(kit, key, parent, centre, axis, rx, ry, thick, lod, mat):
    """Hidden closed disc where a limb can be severed (the runtime scales it from zero)."""
    u, v = (8, 6, 5)[lod], (3, 3, 2)[lod]
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1.0)
    d = Vector(axis).normalized()
    m = Matrix.Translation(Vector(centre)) @ aim(d) @ Matrix.Diagonal(Vector((rx, ry, thick, 1)))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    mesh = bpy.data.meshes.new('stump_' + key)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    for p in mesh.polygons:
        p.use_smooth = False
    o = bpy.data.objects.new('stump_' + key, mesh)
    bpy.context.scene.collection.objects.link(o)
    o['stumpFor'] = key
    o['hidden'] = True
    attach(o, parent)
    return o


def export_lods(kit, rig, caps_spec, targets, glb, extra_stats=None, owners=None):
    """Realise LOD0..2, attach to the rig and export `glb`, `.lod1.glb`, `.lod2.glb`. Returns stats."""
    from pathlib import Path
    out = Path(glb).resolve()
    nodes = make_rig(rig)
    stats = []
    for lod in range(3):
        joined, tris = realise(kit, lod, targets[lod], owners)
        for o in joined.values():
            attach(o, nodes[o.name.split('__')[0]])
        caps = []
        for key, parent, centre, axis, rx, ry, thick in caps_spec:
            caps.append(stump_cap(kit, key, nodes[parent], centre, axis, rx, ry, thick, lod, kit.mat('blood')))
        bpy.context.view_layer.update()
        everything = list(joined.values()) + caps
        total = sum(tri_count(o) for o in everything)
        verts = [o.matrix_world @ v.co for o in joined.values() for v in o.data.vertices]
        lo = [min(v[i] for v in verts) for i in range(3)]
        hi = [max(v[i] for v in verts) for i in range(3)]
        closed = {o.name: is_closed(o) for o in joined.values()}
        path = out if lod == 0 else out.with_name(out.stem + f'.lod{lod}.glb')
        path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.object.select_all(action='DESELECT')
        for o in everything + list(nodes.values()):
            o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                                  export_extras=True, export_cameras=False, export_lights=False)
        stats.append({'lod': lod, 'triangles': total, 'bodyTriangles': tris, 'fileKB': round(path.stat().st_size / 1024, 1),
                      'dimensions': [round(hi[i] - lo[i], 3) for i in range(3)], 'min': [round(v, 3) for v in lo],
                      'max': [round(v, 3) for v in hi], 'allClosed': all(closed.values()),
                      'materials': sorted({m.name for o in joined.values() for m in o.data.materials})})
        if lod < 2:
            for o in everything:
                bpy.data.objects.remove(o)
    return stats, nodes
