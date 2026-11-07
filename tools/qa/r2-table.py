"""Markdown table of corpse vertex tops (m) before/after: r2-table.py <before.txt> <after.txt> (outputs of tools/qa/r2-bounds.mjs)."""
import re, sys
def parse(path):
    rows = {}
    for line in open(path):
        m = re.match(r'(\S+)\s+(death-\S+)\s+max ([\d.]+) min (-?[\d.]+)', line)
        if m:
            rows.setdefault(m.group(1), {})[m.group(2)] = float(m.group(3))
    return rows
a, b = parse(sys.argv[1]), parse(sys.argv[2])
print('| model | death-back | death-side | death-crumple | worst |')
print('| --- | --- | --- | --- | --- |')
for k in a:
    cells = ' | '.join(f"{a[k][d]:.2f} -> {b[k][d]:.2f}" for d in ('death-back', 'death-side', 'death-crumple'))
    print(f"| {k} | {cells} | {max(a[k].values()):.2f} -> {max(b[k].values()):.2f} |")
