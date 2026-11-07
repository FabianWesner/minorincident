"""Summarise a blk-v-l4-corpses receipt: worst rendered vertex top per sample. Usage: r2-l4-summary.py <receipt.json.gz> [more ...]"""
import gzip, json, sys
for path in sys.argv[1:]:
    d = json.load(gzip.open(path))
    samples = d.get('samples', [])
    pairs = [(s['maxRenderedTopM'], i) for i, s in enumerate(samples) if s.get('maxRenderedTopM') is not None]
    top, i = max(pairs) if pairs else (None, None)
    last = samples[-1] if samples else {}
    print(path, 'tier', d.get('tier'), 'samples', len(samples), 'max rendered top m', top and round(top, 3), 'at sample', i)
    if i is not None:
        s = samples[i]
        print('  worst at peak', s.get('worst'), 'tick', s.get('tick'), 'frozen', s.get('frozenBodies'), 'layout', s.get('layoutEnvelopeTopM'))
    print('  final: frozen', last.get('frozenBodies'), 'maxRenderedTop', last.get('maxRenderedTopM'), 'layout', last.get('layoutEnvelopeTopM'), 'audit', last.get('audit'))
    ids = d.get('samples', [{}])[-1].get('corpseIds')
    print('  corpse ids retained at end', len(ids) if ids else ids)
    tops = sorted([s['maxRenderedTopM'] for s in samples if s.get('maxRenderedTopM') is not None])
    if tops:
        print('  median/p90 of per-sample max top', round(tops[len(tops) // 2], 2), round(tops[int(len(tops) * .9)], 2))
