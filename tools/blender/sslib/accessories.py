"""Crowd accessories (hats, hair pieces) for the shared human rig.

Every piece is authored once against a reference cranium (civilian man A, source
metres, +X forward, Z up) and exported in HEAD-JOINT-LOCAL coordinates, so the
runtime parents it to the base's `head` node and applies the per-base `fit`
(scale about the joint, then offset) from the manifest. One neutral material per
piece (hats: picketWhite, hair: hairWhite) so the system lane can tint it.
Triangle caps: LOD0 150, LOD1 80; LOD2 drops the accessory.
"""
import math
from pathlib import Path
import bpy
from mathutils import Vector
from . import sockets, export
from .palette import mat

HEAD_JOINT_Z = 1.055          # man A head joint height; geometry is exported relative to it
C = Vector((-0.02, 0.0, 1.27))     # reference cranium centre (man A hair hull: upper dome centre)
R = (0.187, 0.222, 0.165)        # semi axes of the reference hair hull (boxy superellipsoid)
N_PLAN, N_SIDE = 2.6, 2.9
TRI_CAP = {0: 150, 1: 80}


def spow(value, exponent):
    return math.copysign(abs(value) ** exponent, value)


class Piece:
    """Accumulates verts/faces (tri or quad) for one single-material mesh."""

    def __init__(self, flat=False):
        self.verts, self.faces, self.flat = [], [], flat

    def vert(self, p):
        self.verts.append(tuple(p))
        return len(self.verts) - 1

    def face(self, *ids):
        self.faces.append(tuple(ids))

    def tris(self):
        return sum(1 if len(f) == 3 else 2 for f in self.faces)

    def orient_outward(self, centre):
        """Flip faces so normals point away from `centre` (open shells)."""
        out = []
        for f in self.faces:
            pts = [Vector(self.verts[i]) for i in f]
            n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
            mid = sum(pts, Vector()) / len(pts)
            out.append(f if n.dot(mid - centre) >= 0 else tuple(reversed(f)))
        self.faces = out


def env_point(u, v, infl=(0, 0, 0), plan=N_PLAN, side=N_SIDE, centre=C, radii=R):
    """Superellipsoid point; u azimuth (0 = +X forward, + towards +Y), v elevation (-pi/2..pi/2)."""
    e = 2 / side
    f = spow(math.cos(v), e) if v >= 0 else 1.0
    z = centre.z + (radii[2] + infl[2]) * (spow(math.sin(v), e) if v >= 0 else 0.0)
    pe = 2 / plan
    return Vector((centre.x + (radii[0] + infl[0]) * f * spow(math.cos(u), pe),
                   centre.y + (radii[1] + infl[1]) * f * spow(math.sin(u), pe), z))


def shell(piece, cols, rows, u0, u1, edge_z, infl=0.0, closed=False, low_taper=1.0, bump=0.0,
          centre=C, radii=R, plan=N_PLAN, side=N_SIDE, cut_low=-0.6):
    """Shell over the cranium. `edge_z(u)` is the lower edge height at azimuth u.

    Elevation v runs from the edge up to the pole (one shared top vertex). Edges below
    the equator continue straight down, narrowing by `low_taper` at the edge. `bump`
    adds a deterministic per-vertex radial wobble (curls). Returns the grid of vertex ids.
    """
    zr = radii[2] + infl
    count = cols if closed else cols + 1
    grid = []
    top = None
    for j in range(count):
        u = u0 + (u1 - u0) * (j / cols)
        ez = edge_z(u)
        if ez >= centre.z:
            ve = math.asin(min(1.0, (ez - centre.z) / zr) ** (side / 2))
        else:
            ve = cut_low
        column = []
        for i in range(rows):             # i = 0 edge ... rows-1 just below pole
            v = ve + (math.pi / 2 - ve) * (i / rows)
            if v >= 0:
                p = env_point(u, v, (infl, infl, infl), plan, side, centre, radii)
            else:
                t = v / ve                # 0 at equator, 1 at edge
                p = env_point(u, 0.0, (infl, infl, infl), plan, side, centre, radii)
                p = Vector((p.x, p.y, centre.z + (ez - centre.z) * t))
                k = 1 - (1 - low_taper) * t
                p = Vector((centre.x + (p.x - centre.x) * k, centre.y + (p.y - centre.y) * k, p.z))
            if bump and 0 < i:
                w = 1 + bump * math.sin(j * 2.3 + i * 1.7) * math.cos(j * 1.1 - i * 2.9)
                p = Vector((centre.x + (p.x - centre.x) * w, centre.y + (p.y - centre.y) * w, centre.z + (p.z - centre.z) * (1 + (w - 1) * .5)))
            column.append(piece.vert(p))
        grid.append(column)
    if top is None:
        top = piece.vert(env_point(0, math.pi / 2, (infl, infl, infl), plan, side, centre, radii))
    for j in range(count if closed else cols):
        a, b = grid[j], grid[(j + 1) % count]
        for i in range(rows - 1):
            piece.face(a[i], b[i], b[i + 1], a[i + 1])
        piece.face(a[rows - 1], b[rows - 1], top)
    return grid


def strip(piece, rings):
    """Join consecutive rings (lists of vertex ids, same length) into quads."""
    for a, b in zip(rings, rings[1:]):
        n = len(a)
        for k in range(n):
            piece.face(a[k], a[(k + 1) % n], b[(k + 1) % n], b[k])


def ring(piece, centre, rx, ry, z, n, start=0.0, arc=2 * math.pi, plan=2.0):
    pts = []
    steps = n if arc >= 2 * math.pi - 1e-6 else n + 1
    for k in range(steps):
        a = start + arc * k / n
        pts.append(piece.vert((centre[0] + rx * spow(math.cos(a), 2 / plan), centre[1] + ry * spow(math.sin(a), 2 / plan), z)))
    return pts


def lathe(piece, profile, n, centre=(C.x, 0.0), sx=1.0, sy=1.0, cap_top=True):
    """Revolve [(radius, z)] bottom->top about a vertical axis; radius 0 as last point = pole."""
    rings = []
    for r, z in profile:
        if r <= 1e-6:
            rings.append(piece.vert((centre[0], centre[1], z)))
        else:
            rings.append(ring(piece, centre, r * sx, r * sy, z, n))
    for a, b in zip(rings, rings[1:]):
        if isinstance(b, int):
            for k in range(n):
                piece.face(a[k], a[(k + 1) % n], b)
        else:
            for k in range(n):
                piece.face(a[k], a[(k + 1) % n], b[(k + 1) % n], b[k])
    return rings


def bill(piece, base_u, half_arc, edge_z, reach, droop, infl, cols=3):
    """Flat visor (peak) hanging off the front edge of a cap; returns nothing."""
    inner, outer = [], []
    for j in range(cols + 1):
        u = base_u - half_arc + 2 * half_arc * j / cols
        p = env_point(u, 0.0, (infl, infl, infl))
        z = edge_z
        inner.append(piece.vert((p.x, p.y, z)))
        q = Vector((p.x - C.x, p.y - C.y, 0))
        out = q.normalized() * (q.length + reach * (1 - 0.55 * abs((u - base_u) / half_arc) ** 2)) + Vector((C.x, C.y, 0))
        outer.append(piece.vert((out.x, out.y, z - droop)))
    strip_pts = [inner, outer]
    for a, b in zip(strip_pts, strip_pts[1:]):
        for k in range(cols):
            piece.face(a[k], a[k + 1], b[k + 1], b[k])


def ball(piece, centre, radius, segs, rings_n, squash=1.0):
    top = piece.vert((centre[0], centre[1], centre[2] + radius * squash))
    bot = piece.vert((centre[0], centre[1], centre[2] - radius * squash))
    prev = None
    rows = []
    for i in range(1, rings_n):
        v = math.pi / 2 - math.pi * i / rings_n
        rows.append(ring(piece, (centre[0], centre[1]), radius * math.cos(v), radius * math.cos(v), centre[2] + radius * squash * math.sin(v), segs))
    for k in range(segs):
        piece.face(rows[0][k], rows[0][(k + 1) % segs], top)
        piece.face(rows[-1][(k + 1) % segs], rows[-1][k], bot)
    strip(piece, rows)


def tube(piece, path, radii, sides):
    """Tapered tube along a polyline; last radius 0 closes the tip."""
    rings_ = []
    for idx, (p, r) in enumerate(zip(path, radii)):
        if idx + 1 < len(path):
            d = Vector(path[idx + 1]) - Vector(p)
        else:
            d = Vector(p) - Vector(path[idx - 1])
        d.normalize()
        a = d.cross(Vector((1, 0, 0)) if abs(d.x) < .9 else Vector((0, 1, 0))).normalized()
        b = d.cross(a)
        if r <= 1e-6:
            rings_.append(piece.vert(p))
        else:
            rings_.append([piece.vert(Vector(p) + a * math.cos(2 * math.pi * k / sides) * r + b * math.sin(2 * math.pi * k / sides) * r) for k in range(sides)])
    for a, b in zip(rings_, rings_[1:]):
        if isinstance(b, int):
            for k in range(sides):
                piece.face(a[k], a[(k + 1) % sides], b)
        else:
            for k in range(sides):
                piece.face(a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k])


def to_object(name, piece, token, centre):
    piece.orient_outward(centre)
    z0 = HEAD_JOINT_Z
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x, y, z - z0) for x, y, z in piece.verts], [], piece.faces)
    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = not piece.flat
    # Baked form shading (top bright, underside dark): the crowd draws unlit flat colours, so this
    # vertex colour keeps hats and hair readable and still multiplies with the per-instance tint.
    layer = mesh.color_attributes.new(name='color', type='FLOAT_COLOR', domain='POINT')
    mesh.color_attributes.active_color = layer
    for v in mesh.vertices:
        b = .62 + .38 * min(1.0, max(0.0, v.normal.z * .5 + .55))
        layer.data[v.index].color = (b, b, b, 1)
    material = mat(token)
    material.use_backface_culling = False
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def export_set(asset_id, here, build_piece, token):
    """Build LOD0/LOD1 (`build_piece(lod)` -> (Piece, orient centre)) and export both next to build.py."""
    here = Path(here)
    stats = {}
    for lod in (0, 1):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        piece, centre = build_piece(lod)
        tris = piece.tris()
        if tris > TRI_CAP[lod]:
            raise RuntimeError(f'{asset_id} LOD{lod}: {tris} triangles exceeds {TRI_CAP[lod]}')
        root = sockets.empty('root')
        head = sockets.empty('head', parent=root)
        obj = to_object('body', piece, token, centre)
        obj.parent = head
        bpy.context.view_layer.update()
        export.glb(root, here / ('model.glb' if lod == 0 else 'model.lod1.glb'))
        stats[f'lod{lod}'] = tris
    print('ACC', asset_id, stats)
    return stats
