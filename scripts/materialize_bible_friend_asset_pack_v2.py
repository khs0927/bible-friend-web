#!/usr/bin/env python3
"""Materialize Bible Friend UI asset pack v2 from transparent source sheets.

Why this is intentionally not AI segmentation:
- The source sheets already have a real alpha channel.
- Re-running background-removal/segmentation can alter antialiased edges.
- Connected-component assignment preserves original PNG pixels exactly.

For opaque/problematic future sheets, use rembg/SAM2 as a preprocessing fallback,
then run this deterministic splitter on the transparent result.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "bible-friend" / "v2"
SOURCES = OUT / "_sources"

SHEETS = {
    "core": "https://cdn.creativeclaw.co/u/448e94a9/images/34ee1b1a-22af-45dd-933e-1f7c857d8e96.png",
    "nav": "https://cdn.creativeclaw.co/u/448e94a9/images/932fe6e8-c8a0-4316-9ee0-0826e05e6624.png",
    "mascot": "https://cdn.creativeclaw.co/u/448e94a9/images/7293ed2d-1ac9-4cb1-a499-3930bfced1dc.png",
    "verse": "https://cdn.creativeclaw.co/u/448e94a9/images/9132cf43-e67f-4f0e-8b00-a7b7181df546.png",
    "prayer": "https://cdn.creativeclaw.co/u/448e94a9/images/89f1ecb1-0dc4-4ffe-8039-40fff4110e3d.png",
    "decor": "https://cdn.creativeclaw.co/u/448e94a9/images/170837ac-94ff-4a5a-b617-ed404e77ca36.png",
}

SEEDS = {
    "core": [("app_logo",(205,220)),("mascot_wave",(560,220)),("mascot_bible",(935,220)),("praying_hands",(190,600)),("chat_bubbles",(560,620)),("bible_open",(930,620)),("growth_sprout",(190,945)),("record_notebook",(565,950)),("settings",(930,950)),("close",(190,1235)),("bookmark_outline",(560,1235)),("heart_tile",(930,1235))],
    "nav": [("nav_chat",(170,225)),("nav_story",(490,235)),("nav_growth",(750,230)),("nav_record",(985,235)),("settings_alt",(170,545)),("close_alt",(470,545)),("bookmark_outline_alt",(735,545)),("bookmark_filled",(975,545)),("search",(170,865)),("share",(450,865)),("copy",(710,865)),("back",(980,865)),("microphone",(330,1175)),("favorite_heart",(770,1180))],
    "mascot": [("mascot_wave_v2",(195,250)),("mascot_hug_heart",(555,250)),("mascot_read_bible",(940,250)),("mascot_pray",(195,700)),("mascot_point",(560,705)),("mascot_think",(945,705)),("mascot_celebrate",(175,1145)),("mascot_sit",(455,1145)),("mascot_flower",(710,1145)),("mascot_glowing_bible",(975,1145))],
    "verse": [("dove_olive",(260,205)),("rainbow_cloud",(825,210)),("bible_glowing_heart",(290,555)),("bible_star_bookmark",(835,555)),("candle_book",(230,875)),("cross_hill",(620,885)),("cross_medal",(960,875)),("courage_lion",(205,1190)),("scripture_card",(600,1200)),("shining_cross",(955,1190))],
    "prayer": [("family_praying",(335,185)),("study_wisdom",(835,205)),("friends_teacher_prayer",(335,500)),("bedside_prayer",(830,525)),("candle_prayer",(260,810)),("calendar_answered",(605,815)),("gratitude_flowers",(230,1080)),("heart_cross_hands",(575,1070)),("devotion_books",(930,1070)),("answered_prayer_badge",(590,1300))],
    "decor": [("sparkle_cluster",(190,205)),("star_cluster",(560,205)),("shooting_star",(930,205)),("daisy_cluster",(190,550)),("leaf_sprigs",(560,550)),("flower_bunch",(930,550)),("cloud",(190,875)),("glow_orb",(560,875)),("heart_cluster",(930,875)),("petals",(190,1210)),("light_spark",(560,1210)),("floral_corner",(930,1210))],
}


def download(url: str, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    req = Request(url, headers={"User-Agent": "BibleFriendAssetBot/2"})
    with urlopen(req, timeout=60) as r:
        dst.write_bytes(r.read())


def split(path: Path, seeds, min_component=18, max_distance=260, pad=14):
    img = Image.open(path).convert("RGBA")
    arr = np.asarray(img)
    alpha = arr[:, :, 3]
    labels, _ = ndi.label(alpha > 8)
    objs = ndi.find_objects(labels)
    names = [n for n, _ in seeds]
    coords = np.asarray([xy for _, xy in seeds], dtype=float)
    assignments = {name: [] for name in names}

    for label_id, sl in enumerate(objs, start=1):
        if sl is None:
            continue
        yy, xx = np.where(labels[sl] == label_id)
        area = len(xx)
        if area < min_component:
            continue
        sy, sx = sl[0].start, sl[1].start
        centroid = np.array([sx + xx.mean(), sy + yy.mean()])
        distances = np.sqrt(((coords - centroid) ** 2).sum(axis=1))
        k = int(np.argmin(distances))
        if distances[k] <= max_distance or area > 5000:
            assignments[names[k]].append(label_id)

    outputs = []
    for idx, (name, _) in enumerate(seeds, start=1):
        ids = assignments[name]
        if not ids:
            raise RuntimeError(f"No alpha components assigned to {name}")
        mask = np.isin(labels, ids)
        ys, xs = np.where(mask)
        x0, x1 = max(0, int(xs.min()) - pad), min(img.width, int(xs.max()) + 1 + pad)
        y0, y1 = max(0, int(ys.min()) - pad), min(img.height, int(ys.max()) + 1 + pad)
        crop_arr = arr[y0:y1, x0:x1].copy()
        local_mask = mask[y0:y1, x0:x1]
        crop_arr[:, :, 3] = np.where(local_mask, crop_arr[:, :, 3], 0).astype(np.uint8)
        outputs.append((idx, name, Image.fromarray(crop_arr, "RGBA"), (x0, y0, x1, y1), len(ids)))
    return outputs


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "version": 3,
        "method": "alpha connected-components + nearest-seed assignment",
        "qualityPolicy": "Original generated PNG pixels; lossless RGBA crop only; no resize/JPEG/AI edge regeneration",
        "sourceSheets": SHEETS,
        "assets": [],
    }

    for category, url in SHEETS.items():
        source = SOURCES / f"{category}.png"
        download(url, source)
        im = Image.open(source)
        if im.size != (1122, 1402) or im.mode not in ("RGBA", "LA", "P"):
            raise RuntimeError(f"Unexpected source {category}: size={im.size} mode={im.mode}")
        cat_dir = OUT / category
        cat_dir.mkdir(exist_ok=True)
        for idx, name, crop, bbox, count in split(source, SEEDS[category]):
            target = cat_dir / f"{idx:02d}_{name}.png"
            crop.save(target, "PNG", optimize=False, compress_level=6)
            data = target.read_bytes()
            manifest["assets"].append({
                "category": category,
                "name": name,
                "file": "/" + str(target.relative_to(ROOT / "public")).replace(os.sep, "/"),
                "width": crop.width,
                "height": crop.height,
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "sourceBBox": list(bbox),
                "componentCount": count,
            })

    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if len(manifest["assets"]) != 68:
        raise RuntimeError(f"Expected 68 assets, got {len(manifest['assets'])}")
    print(f"Materialized {len(manifest['assets'])} lossless transparent PNG assets in {OUT}")


if __name__ == "__main__":
    main()
