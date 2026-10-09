"""Fairhaven (L4) authored building set core: explicit recipes for every distance tier.

Every part is a complete closed solid built directly with bmesh. A part is given a
detail level `d` (0 = LOD0 only, 1 = LOD0+LOD1, 2 = all tiers); tiers never decimate,
they omit small trim and drop bevels. Static parts are merged per material by
sslib.export.merge_by_material, joints (doors, shutter, roof) stay separate owners.
+X is forward, Z up (Blender); the exporter converts to glTF +Y up.
"""
import argparse
import json
import math
import shutil
import sys
from pathlib import Path
import bmesh
import bpy
from mathutils import Matrix, Vector
from . import palette, sockets, colliders, export, ao

CAPS = {
    'default': [30000, 12000, 4000],
    'interior': [40000, 15000, 4000],
}


class S:
    """Authoring scene for one distance tier."""

    def __init__(self, asset, lod):
        self.asset, self.lod = asset, lod
        self.root = sockets.empty('root')
        self.root['asset_id'] = asset
        self.root['forward'] = '+X'
        self.body = sockets.empty('body', parent=self.root)
        self.protected = {'body'}
        self.cache = {}

    # ------------------------------------------------------------------ helpers
    def keep(self, d):
        """True when a part of detail level `d` exists at this tier."""
        return self.lod <= d

    def material(self, token):
        if token == 'glow':
            return palette.mat('windowGlow', True)
        return palette.mat(token)

    def joint(self, name, pos=(0, 0, 0), parent=None):
        self.protected.add(name)
        return sockets.empty(name, pos, parent or self.root)

    def _link(self, name, data, pos, rot, parent):
        obj = bpy.data.objects.new(name, data)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = pos
        if rot:
            obj.rotation_euler = rot
        obj.parent = parent or self.body
        return obj

    # ------------------------------------------------------------------ solids
    def box(self, name, pos, size, token, parent=None, rot=None, bevel=None, d=2):
        if not self.keep(d):
            return None
        size = tuple(max(float(v), .004) for v in size)
        if bevel is None:
            bevel = .022 if min(size) >= .14 else 0
        if self.lod > 0 or min(size) < .06:
            bevel = 0
        bevel = min(bevel, min(size) * .3)
        key = (tuple(round(v, 5) for v in size), token, round(bevel, 5))
        data = self.cache.get(key)
        if data is None:
            bm = bmesh.new()
            bmesh.ops.create_cube(bm, size=1.0)
            for v in bm.verts:
                v.co.x *= size[0]
                v.co.y *= size[1]
                v.co.z *= size[2]
            if bevel > 0:
                bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect='EDGES')
            data = bpy.data.meshes.new(name)
            bm.to_mesh(data)
            bm.free()
            data.materials.append(self.material(token))
            self.cache[key] = data
        return self._link(name, data, pos, rot, parent)

    def solid(self, name, verts, faces, token, parent=None, d=2, pos=(0, 0, 0), rot=None):
        """Closed polyhedron from explicit verts/faces; normals are recalculated outward."""
        if not self.keep(d):
            return None
        bm = bmesh.new()
        vs = [bm.verts.new(v) for v in verts]
        for f in faces:
            bm.faces.new([vs[i] for i in f])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        data = bpy.data.meshes.new(name)
        bm.to_mesh(data)
        bm.free()
        data.materials.append(self.material(token))
        return self._link(name, data, pos, rot, parent)

    def extrude(self, name, outline, axis, lo, hi, token, parent=None, d=2):
        """Prism: 2D `outline` in the plane perpendicular to `axis`, spanning lo..hi on that axis.
        axis 'y' => outline is (x, z); axis 'x' => outline is (y, z); axis 'z' => outline is (x, y)."""
        if not self.keep(d):
            return None
        n = len(outline)

        def lift(p, t):
            if axis == 'y':
                return (p[0], t, p[1])
            if axis == 'x':
                return (t, p[0], p[1])
            return (p[0], p[1], t)
        verts = [lift(p, lo) for p in outline] + [lift(p, hi) for p in outline]
        faces = [tuple(range(n)), tuple(range(n, 2 * n))]
        faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
        return self.solid(name, verts, faces, token, parent)

    def slab(self, name, quad, thick, token, parent=None, d=2):
        """Quad plate offset `thick` along its (right-handed) normal p0,p1,p2,p3."""
        if not self.keep(d):
            return None
        p = [Vector(v) for v in quad]
        normal = (p[1] - p[0]).cross(p[3] - p[0]).normalized() * thick
        verts = [tuple(v) for v in p] + [tuple(v + normal) for v in p]
        faces = [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        return self.solid(name, verts, faces, token, parent)

    def beam(self, name, a, b, w, token, parent=None, d=2, depth=None):
        a, b = Vector(a), Vector(b)
        obj = self.box(name, (a + b) / 2, (w, depth or w, (b - a).length), token, parent, bevel=0, d=d)
        if obj is not None:
            obj.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
        return obj

    def tube(self, name, pos, radius, depth, token, rot=(0, 0, 0), parent=None, sides=(14, 10, 8), d=2):
        if not self.keep(d):
            return None
        bpy.ops.mesh.primitive_cylinder_add(vertices=sides[self.lod], radius=radius, depth=depth, location=pos)
        obj = bpy.context.object
        obj.name = name
        obj.data.materials.append(self.material(token))
        obj.rotation_euler = rot
        obj.parent = parent or self.body
        return obj

    def ball(self, name, pos, radius, token, parent=None, d=2):
        if not self.keep(d):
            return None
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2 if self.lod == 0 else 1, radius=radius, location=pos)
        obj = bpy.context.object
        obj.name = name
        obj.data.materials.append(self.material(token))
        obj.parent = parent or self.body
        return obj

    def text(self, label, pos, size, token, parent=None, side=1, d=1, extrude=.012):
        """Geometry lettering readable from +X (side=1) or -X (side=-1)."""
        if not self.keep(d):
            return None
        bpy.ops.object.text_add(location=pos)
        obj = bpy.context.object
        obj.name = 'sign_' + label.replace(' ', '_')
        obj.data.body = label
        obj.data.size = size
        obj.data.align_x = 'CENTER'
        obj.data.align_y = 'CENTER'
        obj.data.extrude = extrude if self.lod == 0 else 0
        obj.data.resolution_u = 2 if self.lod < 2 else 1
        obj.rotation_euler = Matrix(((0, 0, side), (side, 0, 0), (0, 1, 0))).to_euler()
        obj.data.materials.append(self.material(token))
        bpy.ops.object.convert(target='MESH')
        obj.parent = parent or self.body
        return obj

    # ------------------------------------------------------------------ metadata
    def light(self, name, pos, kind='window', color='light_window_warm', intensity=2, rng=6, group='self', emissive=None, tier='all'):
        anchor = sockets.empty('light:' + name, pos, self.root)
        anchor.rotation_euler = (0, -math.pi / 2, 0)
        anchor['ss_light'] = json.dumps({
            'type': kind, 'color': color, 'intensity': intensity, 'range': rng, 'pool': True, 'beam': 'none',
            'flare': False, 'reflect': True, 'shadow': 'none', 'heroPriority': 0, 'flicker': 'none', 'animation': None,
            'powerGroup': group, 'breakable': True, 'emissiveNodes': emissive or ['body_emi_windowGlow'], 'tiers': tier})
        return anchor

    def physics(self, kind='fixed', mass=0, wood=False, sound='prop.stone-heavy'):
        self.root['ss_physics'] = json.dumps({
            'class': kind, 'mass': mass, 'friction': .8, 'restitution': .05, 'centerOfMass': [0, .3, 0],
            'pushable': False, 'kickable': False, 'flammable': wood, 'sounds': sound})


def finish(s, path, caps_key='default'):
    export.merge_by_material(s.root, s.protected)
    bpy.context.view_layer.update()
    meshes = [o for o in s.root.children_recursive if o.type == 'MESH']
    points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    low = [min(v[k] for v in points) for k in range(3)]
    high = [max(v[k] for v in points) for k in range(3)]
    sockets.empty('front', (high[0], (low[1] + high[1]) / 2, 0), s.root)
    physics = json.loads(s.root['ss_physics'])
    physics['centerOfMass'] = [(low[0] + high[0]) / 2, (low[2] + high[2]) / 2, -(low[1] + high[1]) / 2]
    s.root['ss_physics'] = json.dumps(physics)
    ao.bake_all(meshes, 16)
    for obj in meshes:
        for color in obj.data.color_attributes['ao'].data:
            color.color = tuple(.55 + .45 * c for c in color.color[:3]) + (1,)
    export.glb(s.root, path)
    for obj in meshes:
        obj.data.calc_loop_triangles()
    triangles = sum(len(o.data.loop_triangles) for o in meshes)
    cap = CAPS[caps_key][s.lod]
    assert triangles <= cap, (s.asset, s.lod, triangles, cap)
    assert len(meshes) <= 8, (s.asset, s.lod, len(meshes), [m.name for m in meshes])
    return {'triangles': triangles, 'draws': len(meshes), 'materials': len({m.name for o in meshes for m in o.data.materials}),
            'bytes': Path(path).stat().st_size, 'bounds': {'min': [round(v, 3) for v in low], 'max': [round(v, 3) for v in high]},
            'dimensions': {'x': round(high[0] - low[0], 4), 'y': round(high[2] - low[2], 4), 'z': round(high[1] - low[1], 4), 'tolerance': .03}}


def run(asset, source, recipe, caps_key='default'):
    """Standalone entry used by assets/<id>/build.py (called through tools/blender/build.py)."""
    parser = argparse.ArgumentParser()
    parser.add_argument('--glb', required=True)
    parser.add_argument('--quality', default='high')
    parser.add_argument('--distance-tier', type=int, choices=(0, 1, 2))
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    directory = Path(source).resolve().parent
    stats = {}
    tiers = (args.distance_tier,) if args.distance_tier is not None else (0, 1, 2)
    for lod in tiers:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = S(asset, lod)
        recipe(scene)
        path = directory / ('model' + ('' if lod == 0 else '.lod' + str(lod)) + '.glb')
        stats['lod' + str(lod)] = finish(scene, path, caps_key)
        if lod == tiers[0]:
            output = Path(args.glb).resolve()
            output.parent.mkdir(parents=True, exist_ok=True)
            if output != path:
                shutil.copyfile(path, output)
    (directory / 'lod-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
    print(json.dumps(stats))
