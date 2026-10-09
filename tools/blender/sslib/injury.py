"""Shared bandage colouring for the shelter/aftermath characters.

A plain white cylinder reads as a sweatband at the game camera. Paint the wrap in vertex colours instead: a dirty paper
white with a blood-brown stain that wedges down the outward-front side and is strongest low on the wrap (no extra
geometry, no extra material or draw: the wrap keeps its owner's picketWhite batch).
"""
import math

BLOOD = (.50, .03, .03)
PAPER = (.90, .87, .79)


def side_sign(owner_name, translation_y=0.0):
    """+1 for the character's left (+Y) limbs, -1 for the right."""
    if owner_name.endswith('L'): return 1
    if owner_name.endswith('R'): return -1
    return 1 if translation_y >= 0 else -1


def wrap_color(p, center, sign, length, strength=1.0):
    """Vertex colour of a wrap at world point p; center = wrap centre, sign = outward Y side, length = wrap height."""
    dx, dy = p.x - center.x, p.y - center.y
    r = math.hypot(dx, dy)
    # Outward-front direction in the horizontal plane (+X is the front).
    ox, oy = .55, .84 * sign
    cos = (dx * ox + dy * oy) / r if r > 1e-6 else 0
    wedge = max(0.0, (cos + .25) / 1.25)
    h = (p.z - center.z) / (length / 2) if length > 1e-6 else 0
    drip = .62 + .38 * max(-1.0, min(1.0, -h))
    t = min(.95, wedge * drip * 1.45 * strength)
    return (*[PAPER[i] * (1 - t) + BLOOD[i] * t for i in range(3)], 1)
