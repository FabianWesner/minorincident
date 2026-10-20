#!/usr/bin/env python3
"""Share of each frame that is empty flat ground (dress-l9 metric).

Empty flat ground = pixels that match the plain terrain colours AND sit in a smooth neighbourhood (no object, rut, row, patch or
texture breaks them). Plain terrain colours are learnt from a BASELINE render of the undressed level (`--base <dir of png>`): the
dominant non-road colours of those frames (roads are blue-ish at night, ground is green/brown). Roads, markings, props, vehicles,
fields, shoulders and anything else count as covered.

usage: l9-ground-share.py --base <dir> <dir-or-png>... [--json out.json]
"""
import sys, glob, json, os
import numpy as np
from PIL import Image


def load(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.int16)


def smooth_mask(img, thr=2.5):
    """True where a 5x5 neighbourhood has a small luminance range (flat shading, no edges)."""
    lum = (img[:, :, 0] * 3 + img[:, :, 1] * 6 + img[:, :, 2]) // 10
    h, w = lum.shape
    pad = np.pad(lum, 2, mode='edge')
    stack = np.stack([pad[dy:dy + h, dx:dx + w] for dy in range(5) for dx in range(5)])
    return (stack.max(0) - stack.min(0)) <= thr * 2


def is_road_like(img):
    r, g, b = img[:, :, 0], img[:, :, 1], img[:, :, 2]
    return (b - g > 14) & (b > r)


def learn_ground(files):
    hist = {}
    for f in files:
        img = load(f)
        keep = ~is_road_like(img) & smooth_mask(img)
        px = img[keep]
        if not len(px):
            continue
        q = (px // 4)
        keys, counts = np.unique(q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2], return_counts=True)
        for k, c in zip(keys, counts):
            hist[k] = hist.get(k, 0) + c
    top = sorted(hist.items(), key=lambda kv: -kv[1])[:24]
    total = sum(hist.values())
    cols = []
    for k, c in top:
        if c < total * .01:
            break
        cols.append(((k // 4096) * 4 + 2, ((k // 64) % 64) * 4 + 2, (k % 64) * 4 + 2))
    return np.array(cols, dtype=np.int16)


def share(img, ground, tol=9):
    flat = smooth_mask(img)
    near = np.zeros(img.shape[:2], bool)
    for c in ground:
        near |= (np.abs(img - c).max(2) <= tol)
    empty = flat & near & ~is_road_like(img)
    return float(empty.mean())


if __name__ == '__main__':
    args = sys.argv[1:]
    base = args[args.index('--base') + 1]
    out = args[args.index('--json') + 1] if '--json' in args else None
    skip = {args.index('--base'), args.index('--base') + 1} | ({args.index('--json'), args.index('--json') + 1} if out else set())
    targets = [a for i, a in enumerate(args) if i not in skip]
    ground = learn_ground(sorted(glob.glob(os.path.join(base, '*.png'))))
    print('ground colours', ground.tolist())
    rows = {}
    for t in targets:
        files = sorted(glob.glob(os.path.join(t, '*.png'))) if os.path.isdir(t) else [t]
        vals = [share(load(f), ground) for f in files]
        rows[t] = vals
        a = np.array(vals)
        print(f'{t}: frames {len(vals)} mean {a.mean():.3f} p90 {np.percentile(a, 90):.3f} max {a.max():.3f} over40% {(a > .4).sum()}')
    if out:
        json.dump(rows, open(out, 'w'))
