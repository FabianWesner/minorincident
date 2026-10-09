"""Shared bandage colouring for the shelter/aftermath characters.

A plain white cylinder reads as a sweatband at the game camera. Paint the wrap in vertex colours instead: a dirty paper
white with a blood-brown stain that wedges down the outward-front side and is strongest low on the wrap (no extra
geometry, no extra material or draw: the wrap keeps its owner's picketWhite batch).
"""
import math
import bmesh

BLOOD = (.34, .010, .008)
PAPER = (.90, .87, .79)


def side_sign(owner_name, left_y, right_y):
    """Outward Y direction (+1/-1) of the limb `owner_name`, from where the rig's armL/armR actually sit
    (the base rigs name sides independently of the +Y/-Y convention). Centre owners (head) take the left side."""
    left = 1 if left_y > right_y else -1
    return -left if owner_name.endswith('R') else left


def wrap_color(p, center, sign, length, strength=1.0):
    """Vertex colour of a wrap at world point p; center = wrap centre, sign = outward Y side, length = wrap height."""
    dx, dy = p.x - center.x, p.y - center.y
    r = math.hypot(dx, dy)
    # Outward-front direction in the horizontal plane (+X is the front).
    ox, oy = .55, .84 * sign
    cos = (dx * ox + dy * oy) / r if r > 1e-6 else 0
    wedge = max(0.0, (cos - .05) / .95)
    v = (p.z - center.z) / (length / 2) if length > 1e-6 else 0
    bell = math.exp(-((v + .25) / .55) ** 2)
    t = min(.95, wedge * bell * 1.6 * strength)
    return (*[PAPER[i] * (1 - t) + BLOOD[i] * t for i in range(3)], 1)


def add_mid_ring(obj):
    """A primitive cylinder has only its two end rings: one more ring in the middle lets the stain be a patch, not a gradient."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-5]
    bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=True)
    bm.to_mesh(obj.data)
    bm.free()
