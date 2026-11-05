"""Pure geometry primitives shared by the assets/*/build.py scripts (Blender only: mathutils.Vector).

Proven shared recipes only: each returns plain data (points or vertices + faces) and touches no scene state, so every
builder keeps its own mesh()/finish()/material layer and its authored dimensions. Import with
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools' / 'assets')); from blender_prims import ...
"""
import math
from mathutils import Vector

def smooth_path(points, steps=6):
    """Catmull-Rom spline through `points` (end points doubled), `steps` samples per segment."""
    pts = [Vector(points[0]), *[Vector(p) for p in points], Vector(points[-1])]; out = []
    for i in range(1, len(pts) - 2):
        a, b, c, d = pts[i - 1:i + 3]
        for j in range(steps):
            t = j / steps; out.append(.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t))
    out.append(Vector(points[-1])); return out

def tube_geometry(path, r, n=12):
    """(vertices, faces) of a capped n-sided tube of radius r along `path`."""
    vs = []; fs = []
    for i, pt in enumerate(path):
        tangent = Vector(path[min(i + 1, len(path) - 1)]) - Vector(path[max(0, i - 1)]); tangent.normalize()
        u = tangent.cross(Vector((0, 0, 1)))
        if u.length < .1: u = tangent.cross(Vector((1, 0, 0)))
        u.normalize(); v = tangent.cross(u)
        for j in range(n): vs.append(Vector(pt) + r * (u * math.cos(j * math.tau / n) + v * math.sin(j * math.tau / n)))
    for i in range(len(path) - 1):
        for j in range(n): k = i * n + j; l = i * n + (j + 1) % n; fs.append((k, l, l + n, k + n))
    fs += [tuple(reversed(range(n))), tuple((len(path) - 1) * n + j for j in range(n))]
    return vs, fs

def tube_radii_geometry(points, radii, N=10):
    """(vertices, faces) of a capped N-sided tube through `points`; radii[j] is a radius or an (rx, ry) pair."""
    v = []; f = []
    for j, p in enumerate(points):
        tangent = Vector(points[min(j + 1, len(points) - 1)]) - Vector(points[max(j - 1, 0)])
        tangent.normalize(); u = tangent.cross(Vector((1, 0, 0)))
        if u.length < .1: u = tangent.cross(Vector((0, 1, 0)))
        u.normalize(); w = tangent.cross(u); r = radii[j]; rx, ry = (r, r) if isinstance(r, (int, float)) else r
        for i in range(N): v.append(Vector(p) + u * rx * math.cos(i * 2 * math.pi / N) + w * ry * math.sin(i * 2 * math.pi / N))
    for j in range(len(points) - 1):
        for i in range(N): k = j * N + i; kk = j * N + (i + 1) % N; f.append((k, kk, kk + N, k + N))
    f.extend([tuple(range(N - 1, -1, -1)), tuple((len(points) - 1) * N + i for i in range(N))])
    return v, f

def lathe_geometry(loc, profile, n=48):
    """(vertices, faces) of a surface of revolution about the Z axis through `loc`; profile = [(radius, z), ...]."""
    vs = [(loc[0] + r * math.cos(i * math.tau / n), loc[1] + r * math.sin(i * math.tau / n), loc[2] + z) for r, z in profile for i in range(n)]
    fs = [(j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i) for j in range(len(profile) - 1) for i in range(n)]
    return vs, fs

def star_geometry(x, y, z, r):
    """(vertices, faces) of a solid 5-point star plaque in the YZ plane, front at +X, 8 mm thick."""
    pts = [(y + (r if i % 2 == 0 else r * .45) * math.sin(i * math.pi / 5), z + (r if i % 2 == 0 else r * .45) * math.cos(i * math.pi / 5)) for i in range(10)]
    vs = [(xx, yy, zz) for xx in [x, x + .008] for yy, zz in pts]
    fs = [tuple(reversed(range(10))), tuple(range(10, 20))] + [(i, (i + 1) % 10, (i + 1) % 10 + 10, i + 10) for i in range(10)]
    return vs, fs
