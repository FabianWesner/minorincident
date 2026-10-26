#!/usr/bin/env python3
"""Check the tracked evidence tree and relative links using only the standard library."""
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
INLINE = re.compile(r'!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|(?:\\.|[^()\s]|\([^()\n]*\))+)(?:\s+[\"\'][^\n]*?[\"\'])?\s*\)')
REFERENCE = re.compile(r'^ {0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)', re.M)
HTML = re.compile(r'\b(?:href|src)=[\"\']([^\"\']+)[\"\']', re.I)


def links(text):
    # Code samples are not rendered links.
    lines, fence = [], None
    for line in text.splitlines():
        match = re.match(r'^\s*(`{3,}|~{3,})', line)
        if match:
            marker = match.group(1)[0]
            fence = None if fence == marker else marker
        elif fence is None:
            lines.append(re.sub(r'`[^`\n]*`', '', line))
    prose = '\n'.join(lines)
    for pattern in (INLINE, REFERENCE, HTML):
        for match in pattern.finditer(prose):
            yield match.group(1).strip('<>')


def local_target(doc, target):
    url = urlsplit(target)
    if url.scheme or url.netloc or not url.path or url.path.startswith('/'):
        return None
    return (ROOT / doc).parent.joinpath(unquote(url.path)).resolve()


def check():
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')[:-1]
    paths = {(ROOT / p).resolve(): p for p in tracked}
    reports = [p for p in tracked if p.startswith('docs/reports/')]
    markdown = [p for p in tracked if p.endswith('.md') and (p.startswith('docs/reports/') or p == 'docs/process/evidence-retention.md')]
    referenced, errors = set(), []
    for doc in markdown:
        if not (ROOT / doc).is_file():
            errors.append(f'{doc}: tracked document is missing')
            continue
        for target in links((ROOT / doc).read_text(errors='replace')):
            path = local_target(doc, target)
            if path is None:
                continue
            # Check the Git tree, not ignored artifacts left over from a local run.
            if path in paths and path.is_file():
                referenced.add(paths[path])
            elif path.is_dir() and any(p.is_relative_to(path) for p in paths):
                pass
            else:
                errors.append(f'{doc}: unresolved relative link: {target}')
    for path in reports:
        file = ROOT / path
        if not file.is_file():
            errors.append(f'{path}: tracked evidence is missing')
            continue
        if file.stat().st_size > 1_000_000:
            errors.append(f'{path}: exceeds 1 MB')
        if path not in referenced:
            errors.append(f'{path}: no kept Markdown document links to this file')
        if file.suffix.lower() == '.json' and file.stat().st_size >= 300_000:
            errors.append(f'{path}: JSON must be smaller than 300 KB')
        if file.suffix.lower() not in {'.md', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif', '.json'}:
            errors.append(f'{path}: raw artifact belongs in the external archive')
    generated = [p for p in tracked if p.startswith('test-results/')]
    errors.extend(f'{p}: generated artifacts must not be tracked' for p in generated)
    for error in errors:
        print(error, file=sys.stderr)
    print(f'Evidence: {len(reports)} tracked files; {len(markdown)} Markdown documents; {len(errors)} errors')
    return bool(errors)


if __name__ == '__main__':
    sys.exit(check())
