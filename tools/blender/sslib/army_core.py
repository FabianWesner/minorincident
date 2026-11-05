"""Shared builder for the L4 army/reception assets (tank, military helicopter,
HMG nest, reception plaza, field tent).

Geometry is authored per tier from explicit recipes (detail gates on `lod`), never
by decimation. Every primitive is built directly as closed, outward-wound solids
in world space. Static parts are merged per rigid owner and shaded through
palette-tinted vertex colours baked with deterministic AO (same approach as
veh.military-apc), so draws = owners (+ one emissive batch per lit owner).
"""
import json
import math
from contextlib import contextmanager
from pathlib import Path
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector
from . import ao, colliders, export, palette, sockets

IDENT = Matrix.Identity(3)


class Army:
    def __init__(self, asset, lod, root_name='root'):
        self.asset, self.lod = asset, lod
        self.root = sockets.empty(root_name)
        self.root['asset_id'] = asset
        self.world = {root_name: Vector()}
        self.nodes = {root_name: self.root}
        self.protected = set()
        self.ao_floor = 0.0
        self.xf = Matrix.Identity(4)
        self.xf3 = IDENT

    # ------------------------------------------------------------------ structure
    def owner(self, name, pos=(0, 0, 0), parent=None):
        """Rigid owner (pivot) at a world position. Parent defaults to the root."""
        parent = parent or self.root.name
        empty = sockets.empty(name, Vector(pos) - self.world[parent], self.nodes[parent])
        self.world[name] = Vector(pos)
        self.nodes[name] = empty
        self.protected.add(name)
        return empty

    def socket(self, name, pos, parent=None):
        parent = parent or self.root.name
        empty = sockets.empty(name, Vector(pos) - self.world[parent], self.nodes[parent])
        self.world[name] = Vector(pos)
        self.nodes[name] = empty
        return empty

    def collider(self, name, size, pos, parent=None):
        parent = parent or self.root.name
        empty = colliders.cuboid(name, size, Vector(pos) - self.world[parent], self.nodes[parent])
        return empty

    @contextmanager
    def frame(self, origin=(0, 0, 0), yaw=0.0):
        """Place a sub-assembly: everything built inside is rotated about Z then moved."""
        previous = (self.xf, self.xf3)
        local = Matrix.Translation(Vector(origin)) @ Euler((0, 0, yaw)).to_matrix().to_4x4()
        self.xf = previous[0] @ local
        self.xf3 = self.xf.to_3x3()
        try:
            yield
        finally:
            self.xf, self.xf3 = previous

    # ------------------------------------------------------------------ meshes
    def _p(self, v):
        return self.xf @ Vector(v)

    def add(self, name, verts, faces, token, owner='body', emissive=False, closed=True,
            outward=None, bevel=0):
        verts = [tuple(self._p(v)) for v in verts]
        data = bpy.data.meshes.new(name)
        data.from_pydata(verts, [], [tuple(f) for f in faces])
        data.update()
        bm = bmesh.new()
        bm.from_mesh(data)
        if closed:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        elif outward is not None:
            direction = self.xf3 @ Vector(outward)
            bm.faces.ensure_lookup_table()
            if bm.faces and bm.faces[0].normal.dot(direction) < 0:
                bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        bm.to_mesh(data)
        bm.free()
        data.materials.append(palette.mat(token, emissive))
        obj = bpy.data.objects.new(name, data)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = self.nodes[owner]
        obj.matrix_parent_inverse = Matrix.Translation(-self.world[owner])
        if bevel and self.lod == 0:
            mod = obj.modifiers.new('bevel', 'BEVEL')
            mod.width, mod.segments = bevel, 1
        return obj

    def box(self, name, pos, size, token='olive', owner='body', rot=None, bevel=.03, emissive=False):
        bevel = bevel if min(size) >= .08 else 0
        sx, sy, sz = (v / 2 for v in size)
        m = Euler(rot).to_matrix() if rot else IDENT
        pos = Vector(pos)
        verts = [pos + m @ Vector((x * sx, y * sy, z * sz)) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
        faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        return self.add(name, verts, faces, token, owner, emissive, bevel=min(bevel, min(size) * .35))

    def frustum(self, name, a, b, r1, r2=None, token='olive', owner='body', seg=16, caps=True, emissive=False):
        a, b = Vector(a), Vector(b)
        r2 = r1 if r2 is None else r2
        z = (b - a).normalized()
        ref = Vector((0, 0, 1)) if abs(z.z) < .9 else Vector((1, 0, 0))
        u = z.cross(ref).normalized()
        v = z.cross(u)
        n = max(5, min(seg, [seg, 12, 8][self.lod]))
        ring = [(math.cos(i * math.tau / n) * u + math.sin(i * math.tau / n) * v) for i in range(n)]
        verts = [a + r1 * d for d in ring] + [b + r2 * d for d in ring]
        faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        if caps:
            faces += [tuple(range(n)), tuple(range(n, 2 * n))]
        return self.add(name, verts, faces, token, owner, emissive)

    def cyl(self, name, pos, r, depth, token='olive', owner='body', axis='Z', seg=16, r2=None, emissive=False):
        d = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}[axis] * depth / 2
        pos = Vector(pos)
        return self.frustum(name, pos - d, pos + d, r, r2, token, owner, seg, emissive=emissive)

    def rod(self, name, a, b, r=.025, token='uiDark', owner='body', seg=6):
        return self.frustum(name, a, b, r, None, token, owner, seg)

    def loft(self, name, rings, token='olive', owner='body', caps=True):
        n = len(rings[0])
        verts = [v for ring in rings for v in ring]
        faces = [(j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i)
                 for j in range(len(rings) - 1) for i in range(n)]
        if caps:
            faces += [tuple(range(n)), tuple(range((len(rings) - 1) * n, len(rings) * n))]
        return self.add(name, verts, faces, token, owner)

    def tube(self, name, points, r, token='oliveSeam', owner='body', sides=6):
        """Round bar along a polyline (open ends capped)."""
        sides = max(3, min(sides, [sides, 4, 3][self.lod]))
        rings = []
        pts = [Vector(p) for p in points]
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            ref = Vector((0, 0, 1)) if abs(t.z) < .9 else Vector((1, 0, 0))
            u = t.cross(ref).normalized()
            w = t.cross(u)
            rings.append([p + r * (math.cos(k * math.tau / sides) * u + math.sin(k * math.tau / sides) * w)
                          for k in range(sides)])
        return self.loft(name, rings, token, owner)

    def extrude_xz(self, name, pts, y0, y1, token='olive', owner='body'):
        """Polygon in the XZ side view, extruded along Y."""
        n = len(pts)
        verts = [(x, y0, z) for x, z in pts] + [(x, y1, z) for x, z in pts]
        faces = [tuple(range(n)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        return self.add(name, verts, faces, token, owner)

    def extrude_yz(self, name, pts, x0, x1, token='olive', owner='body'):
        """Polygon in the YZ front view, extruded along X."""
        n = len(pts)
        verts = [(x0, y, z) for y, z in pts] + [(x1, y, z) for y, z in pts]
        faces = [tuple(range(n)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        return self.add(name, verts, faces, token, owner)

    def extrude_xy(self, name, pts, z0, z1, token='olive', owner='body'):
        n = len(pts)
        verts = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
        faces = [tuple(range(n)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        return self.add(name, verts, faces, token, owner)

    def band(self, name, outline, thickness, y0, y1, token='uiDark', owner='body'):
        """Closed ring (track) around a CCW XZ outline, extruded along Y."""
        n = len(outline)
        pts = [Vector(p) for p in outline]
        normals = []
        for i in range(n):
            a, b, c = pts[i - 1], pts[i], pts[(i + 1) % n]
            e1, e2 = (b - a).normalized(), (c - b).normalized()
            m = Vector((e1.y + e2.y, -(e1.x + e2.x)))
            normals.append(m.normalized())
        verts = []
        for y in (y0, y1):
            verts += [(p.x + nm.x * thickness / 2, y, p.y + nm.y * thickness / 2) for p, nm in zip(pts, normals)]
            verts += [(p.x - nm.x * thickness / 2, y, p.y - nm.y * thickness / 2) for p, nm in zip(pts, normals)]
        o0, i0, o1, i1 = 0, n, 2 * n, 3 * n
        faces = []
        for i in range(n):
            j = (i + 1) % n
            faces += [(o0 + i, o0 + j, o1 + j, o1 + i), (i0 + i, i0 + j, i1 + j, i1 + i),
                      (o0 + i, o0 + j, i0 + j, i0 + i), (o1 + i, o1 + j, i1 + j, i1 + i)]
        return self.add(name, verts, faces, token, owner)

    def patch(self, name, fn, nx, nt, token, owner='body', outward=None):
        """Open surface sampled from fn(i/nx, j/nt) -> point."""
        verts = [fn(i / nx, j / nt) for i in range(nx + 1) for j in range(nt + 1)]
        faces = [(i * (nt + 1) + j, (i + 1) * (nt + 1) + j, (i + 1) * (nt + 1) + j + 1, i * (nt + 1) + j + 1)
                 for i in range(nx) for j in range(nt)]
        return self.add(name, verts, faces, token, owner, closed=False, outward=outward)

    def physics(self, kind='heavy', mass=0, sounds='prop.metal-heavy', flammable=False, com=(0, 1, 0)):
        self.root['ss_physics'] = json.dumps({
            'class': kind, 'mass': mass, 'friction': .8, 'restitution': .05, 'centerOfMass': list(com),
            'pushable': kind in ('light', 'medium'), 'kickable': kind == 'light',
            'flammable': flammable, 'sounds': sounds})

    def light(self, name, pos, record, rotation=None, parent=None):
        anchor = self.socket('light:' + name, pos, parent)
        if rotation:
            anchor.rotation_euler = rotation
        base = {'pool': False, 'beam': 'none', 'reflect': True, 'shadow': 'none', 'heroPriority': 0,
                'flicker': 'none', 'breakable': True, 'powerGroup': 'self', 'tiers': 'all'}
        base.update(record)
        anchor['ss_light'] = json.dumps(base)
        return anchor

    # ------------------------------------------------------------------ finish
    def finish(self, path, extra_copy=None):
        export.merge_by_material(self.root, self.protected)
        meshes = [o for o in self.root.children_recursive if o.type == 'MESH']
        ao.bake_all(meshes, samples=16 if self.lod else 32)
        if self.ao_floor:
            # Bounded AO contrast keeps the palette readable at game-camera distance.
            for obj in meshes:
                for value in obj.data.color_attributes['ao'].data:
                    value.color = tuple(self.ao_floor + (1 - self.ao_floor) * c for c in value.color[:3]) + (1,)
        white = palette.mat('picketWhite')
        white_rgb = white.diffuse_color[:3]
        for obj in meshes:
            source = obj.data.materials[0]
            if source.name.startswith('emi_'):
                continue
            layer = obj.data.color_attributes.active_color
            tint = source.diffuse_color[:3]
            for value in layer.data:
                c = value.color
                value.color = tuple(c[i] * tint[i] / white_rgb[i] for i in range(3)) + (1,)
            obj.data.materials.clear()
            obj.data.materials.append(white)
        batches = {}
        for obj in meshes:
            batches.setdefault((obj.parent, obj.data.materials[0].name), []).append(obj)
        meshes = []
        for (owner, material), objects in batches.items():
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = objects[0]
            bpy.ops.object.join()
            obj = bpy.context.object
            obj.name = owner.name + '_' + material
            meshes.append(obj)
        bpy.context.view_layer.update()
        points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
        low = [min(p[k] for p in points) for k in range(3)]
        high = [max(p[k] for p in points) for k in range(3)]
        assert abs(low[2]) < .03, 'ground must sit at Z=0, got %.3f' % low[2]
        export.glb(self.root, Path(path).resolve())
        tris = sum(len(o.data.polygons) for o in meshes)
        return {'triangles': tris, 'draws': len(meshes), 'bytes': Path(path).stat().st_size,
                'bounds': {'x': [round(low[0], 3), round(high[0], 3)], 'y': [round(low[1], 3), round(high[1], 3)],
                           'z': [round(low[2], 3), round(high[2], 3)]},
                'dimensions': {'x': round(high[0] - low[0], 3), 'y': round(high[2] - low[2], 3),
                               'z': round(high[1] - low[1], 3), 'tolerance': .1}}


def build_set(asset, directory, recipe, root_name='root'):
    """Build the three authored tiers from explicit recipes (no decimation)."""
    directory = Path(directory)
    stats = {}
    for lod in (0, 1, 2):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        s = Army(asset, lod, root_name)
        recipe(s)
        stats['lod%d' % lod] = s.finish(directory / ('model' + ('' if lod == 0 else '.lod%d' % lod) + '.glb'))
        print('LOD', lod, json.dumps(stats['lod%d' % lod]))
    (directory / 'lod-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
    return stats
