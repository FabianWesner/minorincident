"""Q-269: clean the orange paint blotches off the male courier's white shirt front (TRELLIS bake), in place on model.skin.glb.

QA (final visual review, 10-30): "Orange blotches on the male courier's tier 0-1 shirt". The bake spilled orange from the open shirt
into the white undershirt and onto the bag strap that crosses it. Every texel gets its 3D rest position (UV rasterisation of the
mesh); on the front of the torso an orange texel is repainted when it is enclosed in 3D: white texels on both sides along the body
(left and right within 2 cm, same height; a vertical test also took the strap's own edges and was dropped) make it undershirt, dark strap texels on both sides make it strap. It takes the mean colour
of those neighbours, so the bake's shading stays. The orange shirt itself is never enclosed by white, so it is kept.

Run (python3 with numpy, scipy, Pillow), then compress as in build.py:
  python3 tools/assets/courier-male-shirt-clean.py assets/char.courier-male-skin/model.skin.glb [--preview out.png]
  npx tsx tools/assets/courier-tex-compress.ts assets/char.courier-male-skin/model.skin.glb public/assets/models/char.courier-male.skin.glb
Run it once: each run repaints the texels its 2 cm reach finds enclosed, so a second run would grow the repaint further.
"""
import io, json, struct, sys
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

path = sys.argv[1]
preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
raw = open(path, 'rb').read()
assert raw[:4] == b'glTF'
jlen = struct.unpack_from('<I', raw, 12)[0]; gltf = json.loads(raw[20:20 + jlen])
blen = struct.unpack_from('<I', raw, 20 + jlen)[0]; binc = raw[28 + jlen:28 + jlen + blen]
CT = {5126: ('f', 4), 5125: ('I', 4), 5123: ('H', 2), 5121: ('B', 1)}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def acc(i):
    a = gltf['accessors'][i]; v = gltf['bufferViews'][a['bufferView']]; f, s = CT[a['componentType']]; n = NC[a['type']]
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0); stride = v.get('byteStride', s * n)
    dt = np.dtype('<' + f)
    out = np.ndarray((a['count'], n), dt, binc, off, (stride, s)).astype(np.float64)
    return out
prim = gltf['meshes'][0]['primitives'][0]
P = acc(prim['attributes']['POSITION']); U = acc(prim['attributes']['TEXCOORD_0']); I = acc(prim['indices']).astype(int).reshape(-1, 3)
img_i = gltf['textures'][gltf['materials'][prim['material']]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
view_i = gltf['images'][img_i]['bufferView']; v = gltf['bufferViews'][view_i]
tex = np.array(Image.open(io.BytesIO(binc[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']])).convert('RGB')).astype(np.float64) / 255
H, W = tex.shape[:2]

# texel -> rest position and face normal (glTF frame: +X forward, +Y up, +Z = his right)
pos = np.full((H, W, 3), np.nan); nrm = np.zeros((H, W, 3))
np.seterr(all="ignore")
for t in I:
    A, B, C = U[t] * [W, H]
    x0, y0 = np.floor(np.minimum(np.minimum(A, B), C)).astype(int); x1, y1 = np.ceil(np.maximum(np.maximum(A, B), C)).astype(int)
    x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
    if x1 < x0 or y1 < y0: continue
    den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1])
    if abs(den) < 1e-12: continue
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5)
    w0 = ((B[1] - C[1]) * (xs - C[0]) + (C[0] - B[0]) * (ys - C[1])) / den
    w1 = ((C[1] - A[1]) * (xs - C[0]) + (A[0] - C[0]) * (ys - C[1])) / den
    m = (w0 >= -.01) & (w1 >= -.01) & (1 - w0 - w1 >= -.01)
    if not m.any(): continue
    Wt = np.stack([w0[m], w1[m], 1 - w0[m] - w1[m]], 1); a, b, c = P[t]; n = np.cross(b - a, c - a)
    yy, xx = (ys[m] - .5).astype(int), (xs[m] - .5).astype(int)
    pos[yy, xx] = Wt @ P[t]; nrm[yy, xx] = n / (np.linalg.norm(n) + 1e-12)

mx = tex.max(-1); mn = tex.min(-1); sat = (mx - mn) / np.maximum(mx, 1e-3)
front = ~np.isnan(pos[..., 0]) & (nrm[..., 0] > .25) & (pos[..., 0] > 0) & (pos[..., 1] > .66) & (pos[..., 1] < .96) & (np.abs(pos[..., 2]) < .15)
white = front & (mx > .62) & (sat < .22)
strap = front & (mx < .5) & (tex[..., 2] >= tex[..., 0] - .02)
orange = front & (tex[..., 0] > .45) & (tex[..., 1] < .72 * tex[..., 0]) & (tex[..., 2] < .45 * tex[..., 0] + .05)

def enclosed(cand, by, reach=.02, dy=.006):
    """cand texels with `by` texels on both sides along z (within reach, same height +- dy): returns (mask, colour)."""
    yy, xx = np.nonzero(by); tree = cKDTree(pos[yy, xx]); cols = tex[yy, xx]; bz = pos[yy, xx, 2]; byy = pos[yy, xx, 1]
    cy, cx = np.nonzero(cand); hit = np.zeros(cand.shape, bool); colour = np.zeros_like(tex)
    for k, near in enumerate(tree.query_ball_point(pos[cy, cx], reach)):
        if not near: continue
        near = np.array(near); p = pos[cy[k], cx[k]]
        row = near[np.abs(byy[near] - p[1]) < dy]; dz = bz[row] - p[2]
        if (dz < -.003).any() and (dz > .003).any(): hit[cy[k], cx[k]] = True; colour[cy[k], cx[k]] = cols[row].mean(0)
    return hit, colour

out = tex.copy(); total = 0
for by in (white, strap):
    hit, colour = enclosed(orange & ~(out != tex).any(-1), by)
    out[hit] = colour[hit]; total += int(hit.sum())
print('repainted texels', total)
if preview:
    pv = (tex * 255).astype(np.uint8); pv[(out != tex).any(-1)] = (255, 0, 255); Image.fromarray(pv).save(preview)
if total and '--dry' not in sys.argv:
    buf = io.BytesIO(); Image.fromarray((np.clip(out, 0, 1) * 255 + .5).astype(np.uint8)).save(buf, 'PNG'); png = buf.getvalue()
    # rebuild the binary chunk with the new image view (every view keeps its order, 4-byte aligned)
    chunks, off = [], 0
    for i, bv in enumerate(gltf['bufferViews']):
        data = png if i == view_i else binc[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        pad = (-off) % 4; chunks.append(b'\0' * pad); off += pad
        bv['byteOffset'] = off; bv['byteLength'] = len(data); chunks.append(data); off += len(data)
    newbin = b''.join(chunks); newbin += b'\0' * ((-len(newbin)) % 4); gltf['buffers'][0]['byteLength'] = len(newbin)
    js = json.dumps(gltf, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4)
    body = struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(newbin), b'BIN\0') + newbin
    open(path, 'wb').write(struct.pack('<4sII', b'glTF', 2, 12 + len(body)) + body)
    print('wrote', path)
