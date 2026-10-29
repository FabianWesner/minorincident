"""Repack the existing zoo export without rebuilding or changing its geometry.

Layout.export supplies the same flags for future Blender rebuilds.
"""
import copy
import hashlib
import json
import struct
from pathlib import Path

layout = Path('public/assets/layouts/D-ZOO.layout.json')
data = json.loads(layout.read_bytes())
layout.write_text(json.dumps(data, sort_keys=True, separators=(',', ':')) + '\n')
assert json.loads(layout.read_bytes()) == data

path = Path('public/assets/layouts/D-ZOO.base.glb')
source = path.read_bytes()
json_length, chunk_type = struct.unpack_from('<II', source, 12)
assert chunk_type == 0x4E4F534A
original = json.loads(source[20:20 + json_length])
packed = copy.deepcopy(original)
meshes = 0
for node in packed['nodes']:
    if 'mesh' in node:
        node.setdefault('extras', {})['preRenderShared'] = True
        meshes += 1
encoded = json.dumps(packed, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
binary = source[20 + json_length:]
output = struct.pack('<III', 0x46546C67, 2, 20 + len(encoded) + len(binary))
output += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + binary
path.write_bytes(output)
assert output[20 + len(encoded):] == binary
print(json.dumps(dict(meshesMarkedShared=meshes, beforeGlbBytes=len(source), afterGlbBytes=len(output),
                      geometryAndMaterialsUnchanged=True, binaryChunkSha256=hashlib.sha256(binary).hexdigest()), indent=2))
