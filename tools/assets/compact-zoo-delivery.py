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
if not packed['scenes'][0].get('extras', {}).get('layoutMarkers'):
    assert len(packed['scenes']) == 1 and not packed.get('skins') and not packed.get('animations')
    roots = packed['scenes'][0]['nodes']
    marker_indices = [i for i in roots if 'mesh' not in packed['nodes'][i] and not packed['nodes'][i].get('children') and
                      any(k in packed['nodes'][i].get('extras', {}) for k in ('assetId', 'foliageColors'))]
    extras, table, records = [], {}, []
    for i in marker_indices:
        node = packed['nodes'][i]
        assert set(node) <= {'name', 'extras', 'translation', 'rotation', 'scale'}
        key = json.dumps(node['extras'], sort_keys=True)
        if key not in table:
            table[key] = len(extras)
            extras.append(node['extras'])
        records.append([node['name'], table[key], node.get('translation'), node.get('rotation'), node.get('scale')])
    removed = set(marker_indices)
    mapping = {old: new for new, old in enumerate(i for i in range(len(packed['nodes'])) if i not in removed)}
    nodes = [n for i, n in enumerate(packed['nodes']) if i not in removed]
    for node in nodes:
        if 'children' in node: node['children'] = [mapping[i] for i in node['children']]
    packed['nodes'] = nodes
    packed['scenes'][0]['nodes'] = [mapping[i] for i in roots if i not in removed]
    packed['scenes'][0].setdefault('extras', {})['layoutMarkers'] = dict(extras=extras, records=records)
    # Prove that compact tuples reconstruct every original reference exactly.
    for i, record in zip(marker_indices, records):
        name, index, translation, rotation, scale = record
        node = dict(name=name, extras=extras[index])
        for key, value in [('translation', translation), ('rotation', rotation), ('scale', scale)]:
            if value is not None: node[key] = value
        assert node == original['nodes'][i]
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
