#!/usr/bin/env python3
"""Fetch OSM tiles around Yeouido Hangang Park, stitch, darken for the watch map screen."""
import math, io, time, pathlib, urllib.request
from PIL import Image, ImageEnhance

SP = pathlib.Path(__file__).parent
Z = 16
# Yeouido Hangang Park (running mecca; deliberately NOT the user's neighborhood)
LAT, LON = 37.5285, 126.9340

def deg2num(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y

cx, cy = deg2num(LAT, LON, Z)
x0, y0 = int(cx) - 2, int(cy) - 2   # 5x5 tiles = 1280x1280, crop later
canvas = Image.new("RGB", (5 * 256, 5 * 256))
for dx in range(5):
    for dy in range(5):
        url = f"https://tile.openstreetmap.org/{Z}/{x0+dx}/{y0+dy}.png"
        req = urllib.request.Request(url, headers={"User-Agent": "runvis-web-mockup/1.0 (one-time marketing image)"})
        with urllib.request.urlopen(req, timeout=15) as r:
            tile = Image.open(io.BytesIO(r.read())).convert("RGB")
        canvas.paste(tile, (dx * 256, dy * 256))
        time.sleep(0.15)

# center crop to screen aspect 820x1015
px = (cx - x0) * 256
py = (cy - y0) * 256
W, H = 820, 1015
left = int(px - W / 2); top = int(py - H / 2)
crop = canvas.crop((left, top, left + W, top + H))

# dark-map treatment: desaturate + darken + slight cool tint
crop = ImageEnhance.Color(crop).enhance(0.35)
crop = ImageEnhance.Brightness(crop).enhance(0.55)
crop = ImageEnhance.Contrast(crop).enhance(1.12)
tint = Image.new("RGB", crop.size, (10, 16, 24))
crop = Image.blend(crop, tint, 0.18)
crop.save(SP / "map-base.png")
print("saved map-base.png", crop.size, "center px in crop:", W/2, H/2)
