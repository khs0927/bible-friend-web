#!/usr/bin/env python3
"""Materialize Bible Friend records runtime PNG assets from downloaded Figma sheets.

Reads source sheets from client/public/assets/bible-friend/records/_sources (when
present) and writes trimmed runtime PNGs, then writes manifest.json listing every
runtime PNG that decodes cleanly. The client uses the manifest to decide which
art is available locally. No downscale or JPEG conversion.
"""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil
import struct

root = Path('client/public/assets/bible-friend/records')


def drop_edge_fragments(tile):
    """Clear pieces of neighbouring art that bleed in across the cell edges.

    Opaque regions (4-connected, alpha > 16) that touch the tile border belong
    to the next cell, unless they are the tile's main subject (the largest one).
    """
    alpha = tile.getchannel('A')
    w, h = tile.size
    px = alpha.load()
    seen = bytearray(w * h)
    regions = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy] <= 16:
                continue
            stack = [(sx, sy)]
            seen[sy * w + sx] = 1
            pixels = []
            edge = False
            while stack:
                x, y = stack.pop()
                pixels.append((x, y))
                if x in (0, w - 1) or y in (0, h - 1):
                    edge = True
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny] > 16:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            regions.append((edge, pixels))
    if not regions:
        return tile
    largest = max(len(p) for _, p in regions)
    out = tile.copy()
    opx = out.load()
    for edge, pixels in regions:
        if edge and len(pixels) < largest:
            for x, y in pixels:
                opx[x, y] = (0, 0, 0, 0)
    return out


def split_sheet(source, outdir, names, cols, rows):
    img = Image.open(source).convert('RGBA')
    w, h = img.size
    outdir.mkdir(parents=True, exist_ok=True)
    for idx, name in enumerate(names):
        c = idx % cols
        r = idx // cols
        tile = img.crop((
            round(c * w / cols),
            round(r * h / rows),
            round((c + 1) * w / cols),
            round((r + 1) * h / rows),
        ))
        tile = drop_edge_fragments(tile)
        box = tile.getchannel('A').getbbox()
        if box:
            tile = tile.crop(box)
        tile.save(outdir / name, format='PNG', optimize=False, compress_level=6)


def limit_size(path, max_side):
    """Icons are shown at ~40px; 512px keeps them sharp at 3x without 1MB files."""
    with Image.open(path) as im:
        if max(im.size) <= max_side:
            return
        im = im.convert('RGBA')
        im.thumbnail((max_side, max_side), Image.LANCZOS)
        im.save(path, format='PNG', optimize=True)


SHEETS = [
    ('nav-sheet.png', 'nav', ['app-logo.png', 'chat.png', 'story.png', 'growth.png', 'record.png', 'microphone.png', 'hearts.png', 'sparkles.png', 'stars.png', 'shooting-star.png'], 2, 5),
    ('verse-sheet.png', 'verse', ['open-bible-glow.png', 'open-bible-star.png', 'scripture-card.png', 'cross-hill.png', 'dove-branch.png', 'rainbow-cloud.png', 'courage-lion.png', 'scripture-lamp.png', 'heart-bible.png', 'prayer-ribbon.png'], 2, 5),
    ('prayer-sheet.png', 'prayer', ['family.png', 'child-bedside.png', 'study.png', 'friends-teacher.png', 'candle.png', 'answered-check.png', 'gratitude-flower.png', 'calendar.png', 'hands-alt.png', 'heart-cross.png'], 2, 5),
    ('mascot-sheet.png', 'mascot', ['wave.png', 'heart.png', 'praying.png', 'reading.png', 'pointing.png', 'celebrating.png', 'listening.png', 'sitting.png'], 2, 4),
]
sources = root / '_sources'
for sheet, outdir, names, cols, rows in SHEETS:
    if (sources / sheet).exists():
        split_sheet(sources / sheet, root / outdir, names, cols, rows)
# Keep the original sheets outside the served folder so the split can be checked.
if sources.exists():
    archive = Path('design/records-sources')
    archive.mkdir(parents=True, exist_ok=True)
    for sheet in sources.glob('*.png'):
        shutil.copy2(sheet, archive / sheet.name)
shutil.rmtree(sources, ignore_errors=True)
for icon in (root / 'hq').glob('*.png'):
    limit_size(icon, 512)

items = []
for p in sorted(root.rglob('*.png')):
    if '_sources' in p.parts:
        continue
    data = p.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit(f'not PNG: {p}')
    w, h = struct.unpack('>II', data[16:24])
    try:
        with Image.open(p) as im:
            im.load()
    except Exception as error:  # damaged data: leave it out so the client falls back
        print(f'SKIP damaged PNG {p}: {error}')
        continue
    items.append({
        'file': str(p.relative_to(root)),
        'width': w,
        'height': h,
        'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(),
    })

manifest = {
    'figmaFileKey': 'cqQhO3opkgUmaEgOPAEUt3',
    'figmaBoardNodeId': '38:2',
    'qualityPolicy': 'Original standalone PNGs copied byte-for-byte; sheet assets cell-cropped and alpha-trimmed only; no downscale or JPEG conversion.',
    'count': len(items),
    'assets': items,
}
(root / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'VERIFIED {len(items)} runtime PNG assets')
