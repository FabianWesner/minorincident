"""look-l10: write the Scene Lab catalog scenes tests/scenes/catalog/look-l10-*.json (one dressed game-camera run per region).
python3 tools/qa/l10-look-scenes.py"""
import json
from pathlib import Path

SPOTS = [
    ('r1-crash', 570, 0, 640, 0, 'R1 crash outskirts: L9 bridge kit and convoy wrecks behind the courier, burned cars and sandbags on the khaki scar, fence/pole line.'),
    ('r2-fringe', 1090, 25, 1180, 25, 'R2 residential fringe: front yards with lit windows, verge grass, hedges, sodium lamps, parked cars, gas station.'),
    ('r3-depot', 1400, 100, 1480, 100, 'R3 industrial: depot buildings, container/drum stacks, box/fuel trucks, utility poles and sodium yard lamps.'),
    ('r4-military', 2250, -75, 2330, -75, 'R4 military: jersey/sandbag lines, guard towers, armour wrecks, army checkpoints with white floods.'),
    ('r5-campus', 2600, 45, 2680, 45, 'R5 research campus: iso tents, generators, ambulances, annex labs, quarantine fences, cold floods.'),
    ('r6-corridor', 3100, 95, 3180, 95, 'R6 destroyed corridor: burned houses and brick fronts, burned buses/cars, red emergency lights.'),
    ('r7-approach', 3800, -41, 3880, -41, 'R7 plant approach: pipe runs, tanks, substations, mil fence, service lamps; towers behind.'),
]
out = Path(__file__).resolve().parents[2] / 'tests/scenes/catalog'
for sid, x, z, tx, tz, note in SPOTS:
    spec = {
        'name': f'look-l10-{sid}',
        'note': f'look-l10 game-camera dressing check. {note} Look for: a silhouette and a light point in every frame, nothing floating or sunk, no prop in the walkable lane, night still dark.',
        'seed': 32, 'ground': 'district', 'time': 'L10-night', 'dof': False,
        'layout': {'district': 'D-CURE', 'bbox': [[x - 90, z - 70], [x + 130, z + 70]]},
        'actors': [{'id': 'courier', 'kind': 'courier', 'at': [x, z]}],
        'camera': {'mode': 'game', 'target': 'courier', 'zoom': 1},
        'frames': 240, 'sheet': 40,
        'script': [{'frame': 0, 'actor': 'courier', 'do': {'run': [[tx, tz]]}}],
        'clipping': {'ignoreFoliage': True},
        'expect': {'consoleErrors': 0, 'clippingMax': 0, 'undrawnFramesMax': 0, 'drawCallsMax': 300, 'trianglesMax': 500000, 'lodPlaceholderFramesMax': 0},
    }
    (out / f'look-l10-{sid}.json').write_text(json.dumps(spec, indent=1) + '\n')
    print(out / f'look-l10-{sid}.json')
