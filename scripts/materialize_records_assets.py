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


def cut_boxes(source, outdir, boxes, pad=8):
    """Cut each named item out of a free-form sheet by its bounding box.

    Boxes (x0, y0, x1, y1) are in the sheet's own pixels (852x1847 exports) and
    were found by grouping opaque regions; see design/records-sources.
    """
    img = Image.open(source).convert('RGBA')
    w, h = img.size
    outdir.mkdir(parents=True, exist_ok=True)
    for name, (x0, y0, x1, y1) in boxes.items():
        tile = img.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))
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


SHEETS = {
    'verse-sheet.png': ('verse', {
        'heart-bible.png': (463, 82, 816, 480),
        'open-bible-glow.png': (42, 460, 436, 805),
        'open-bible-star.png': (480, 554, 822, 797),
        'scripture-card.png': (20, 839, 459, 1116),
        'cross-hill.png': (478, 841, 818, 1145),
        'dove-branch.png': (71, 1145, 403, 1396),
        'rainbow-cloud.png': (480, 1189, 816, 1400),
        'courage-lion.png': (36, 1420, 302, 1774),
        'scripture-lamp.png': (328, 1441, 586, 1773),
        'prayer-ribbon.png': (605, 1446, 832, 1749),
    }),
    'prayer-sheet.png': ('prayer', {
        'family.png': (47, 39, 437, 401),
        'child-bedside.png': (465, 94, 822, 398),
        'study.png': (36, 465, 385, 772),
        'friends-teacher.png': (424, 449, 828, 775),
        'candle.png': (82, 802, 360, 1112),
        'answered-check.png': (482, 826, 747, 1105),
        'gratitude-flower.png': (84, 1154, 362, 1452),
        'calendar.png': (465, 1190, 786, 1450),
        'hands-alt.png': (86, 1480, 353, 1777),
        'heart-cross.png': (478, 1500, 788, 1767),
    }),
    'mascot-sheet.png': ('mascot', {
        'wave.png': (33, 25, 409, 442),
        'heart.png': (448, 58, 835, 434),
        'praying.png': (31, 479, 392, 884),
        'reading.png': (484, 480, 817, 884),
        'pointing.png': (35, 927, 425, 1326),
        'celebrating.png': (461, 921, 826, 1332),
        'listening.png': (21, 1363, 398, 1778),
        'sitting.png': (484, 1385, 805, 1777),
    }),
    'nav-sheet.png': ('nav', {
        'app-logo.png': (19, 55, 258, 293),
        'chat.png': (281, 112, 463, 272),
        'story.png': (480, 120, 655, 268),
        'growth.png': (681, 99, 824, 275),
        'record.png': (24, 340, 201, 546),
        'microphone.png': (245, 346, 443, 545),
        'hearts.png': (474, 373, 651, 538),
        'sparkles.png': (690, 380, 824, 538),
        'stars.png': (111, 597, 332, 771),
        'shooting-star.png': (427, 600, 763, 764),
    }),
}
sources = root / '_sources'
# Use freshly downloaded sheets, else the archived copies.
archive = Path('design/records-sources')
for sheet, (outdir, boxes) in SHEETS.items():
    source = sources / sheet if (sources / sheet).exists() else archive / sheet
    if source.exists():
        cut_boxes(source, root / outdir, boxes)
# Keep the original sheets outside the served folder so the split can be checked.
if sources.exists():
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
