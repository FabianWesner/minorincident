"""Headless Blender check: authoring helper reproduces repaired emitter metadata without rebuilding assets."""
import json
from pathlib import Path
import sys
import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/blender'))
from sslib.equipment_lights import install, RECORDS
rows = []
for asset in [*RECORDS, 'wpn.minigun-mounted']:
    for suffix in ('', '.lod1', '.lod2'):
        path = ROOT / 'assets' / asset / f'model{suffix}.glb'
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(path))
        bpy.context.view_layer.update()
        root = next((o for o in bpy.context.scene.objects if o.get('asset_id') == asset), None)
        if asset != 'acc.headlamp':
            assert root is not None, (asset, 'missing authored root')
        original = next((o for o in bpy.context.scene.objects if o.name == 'light:equipment'), None)
        original_position = original.matrix_world.translation.copy() if original else None
        if original:
            bpy.data.objects.remove(original, do_unlink=True)
        if asset == 'wpn.minigun-mounted':
            for obj in bpy.context.scene.objects:
                if 'decorativeEmissive' in obj:
                    del obj['decorativeEmissive']
        meshes_before = {o.name for o in bpy.context.scene.objects if o.type == 'MESH'}
        install(asset, root)
        bpy.context.view_layer.update()
        assert meshes_before == {o.name for o in bpy.context.scene.objects if o.type == 'MESH'}
        if asset == 'wpn.minigun-mounted':
            heat = [o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m and m.name == 'emi_orange' for m in o.data.materials)]
            assert heat and all(o.get('decorativeEmissive') for o in heat)
            rows.append({'asset': asset, 'tier': suffix or 'lod0', 'heatEffects': len(heat), 'noGeometryChanged': True})
            continue
        anchor = bpy.data.objects['light:equipment']
        delta = (anchor.matrix_world.translation - original_position).length
        assert delta < .0001, (asset, suffix, delta)
        light = json.loads(anchor['ss_light'])
        expected = {o.name for o in bpy.context.scene.objects if o.type == 'MESH' and any(m and m.name.startswith('emi_') for m in o.data.materials)}
        assert set(light['emissiveNodes']) == expected
        rows.append({'asset': asset, 'tier': suffix or 'lod0', 'positionDeltaM': delta, 'emissiveNodes': light['emissiveNodes'], 'noGeometryChanged': True})
out = ROOT / 'docs/reports/e25-emitters/evidence/equipment-authoring-check.json'
out.write_text(json.dumps({'blender': bpy.app.version_string, 'checks': len(rows), 'failures': 0, 'rows': rows}, indent=2) + '\n')
print('E25 equipment authoring:', len(rows), 'checks, zero failures')
