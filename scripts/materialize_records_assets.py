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
        box = tile.getchannel('A').getbbox()
        if box:
            tile = tile.crop(box)
        tile.save(outdir / name, format='PNG', optimize=False, compress_level=6)



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
shutil.rmtree(sources, ignore_errors=True)

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
