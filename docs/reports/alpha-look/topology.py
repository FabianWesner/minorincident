"""Count welded boundary edges in uncompressed authored LOD1/2 exports."""
import collections
import json
import struct
import sys
from pathlib import Path
rows = []
for lod in (1, 2):
    data = (Path(sys.argv[1]) / f'model.lod{lod}.glb').read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc, body = json.loads(data[20:20 + length]), data[28 + length:]
    def accessor(index):
        a = doc['accessors'][index]
        view = doc['bufferViews'][a['bufferView']]
        width = {'VEC3': 3, 'SCALAR': 1}[a['type']]
        fmt = {5126: 'f', 5123: 'H', 5125: 'I', 5121: 'B'}[a['componentType']]
        stride = view.get('byteStride', struct.calcsize(fmt) * width)
        start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        return [struct.unpack_from('<' + fmt * width, body, start + i * stride) for i in range(a['count'])]
    for mesh in doc['meshes']:
        edges = collections.Counter()
        triangles = 0
        for primitive in mesh['primitives']:
            vertices = [tuple(round(v, 5) for v in point) for point in accessor(primitive['attributes']['POSITION'])]
            indices = [i[0] for i in accessor(primitive['indices'])]
            triangles += len(indices) // 3
            for i in range(0, len(indices), 3):
                tri = [vertices[j] for j in indices[i:i + 3]]
                for a, b in zip(tri, tri[1:] + tri[:1]):
                    edges[tuple(sorted((a, b)))] += 1
        rows.append({'lod': lod, 'mesh': mesh.get('name'), 'triangles': triangles,
                     'boundaryEdges': sum(n == 1 for n in edges.values()),
                     'nonManifoldEdges': sum(n != 2 for n in edges.values())})
Path(sys.argv[2]).write_text(json.dumps(rows, indent=2) + '\n')
print(json.dumps({'primitives': len(rows), 'boundaryEdges': sum(r['boundaryEdges'] for r in rows),
                  'nonManifoldEdges': sum(r['nonManifoldEdges'] for r in rows)}))
