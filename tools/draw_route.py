#!/usr/bin/env python3
"""Draw the running route + HUD onto the darkened Yeouido map → shotMap.png."""
import pathlib
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SP = pathlib.Path(__file__).parent
OUTDIR = pathlib.Path("/Users/curara/Downloads/Runvis_스크린_PNG")

img = Image.open(SP / "map-base.png").convert("RGBA")
W, H = img.size

# Route: along the Hangang-park riverside trail (visually follows the
# 한강자전거길 band on this crop), start near 여의서로 park, currently
# heading toward 원효대교 남단.
pts = [(150, 355), (215, 420), (268, 470), (305, 520), (345, 570),
       (395, 615), (450, 655), (520, 700), (590, 740), (655, 775), (718, 818)]
GREEN = (61, 220, 132, 255)

# glow underlay
glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.line(pts, fill=(61, 220, 132, 160), width=22, joint="curve")
glow = glow.filter(ImageFilter.GaussianBlur(10))
img = Image.alpha_composite(img, glow)

d = ImageDraw.Draw(img)
d.line(pts, fill=GREEN, width=7, joint="curve")

# start pin
sx, sy = pts[0]
d.ellipse([sx-11, sy-11, sx+11, sy+11], fill=(4, 18, 12, 255), outline=GREEN, width=4)
# current position (white ring + blue core, Apple-style)
cx, cy = pts[-1]
d.ellipse([cx-16, cy-16, cx+16, cy+16], fill=(255, 255, 255, 60))
d.ellipse([cx-12, cy-12, cx+12, cy+12], fill=(255, 255, 255, 255))
d.ellipse([cx-9, cy-9, cx+9, cy+9], fill=(10, 132, 255, 255))

def font(size, bold=False):
    try:
        return ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", size,
                                  index=5 if bold else 2)
    except Exception:
        return ImageFont.load_default()

# bottom metric bar (same values as the rest of the site's live-run snapshot)
bar = Image.new("RGBA", img.size, (0, 0, 0, 0))
bd = ImageDraw.Draw(bar)
bx0, by0, bx1, by1 = 55, H-190, W-55, H-75
bd.rounded_rectangle([bx0, by0, bx1, by1], radius=28, fill=(0, 0, 0, 195))
img = Image.alpha_composite(img, bar)
d = ImageDraw.Draw(img)
cols = [("거리", "4.82", (255, 255, 255)), ("시간", "26:08", (255, 255, 255)), ("페이스", "5:24", (61, 220, 132))]
seg = (bx1 - bx0) / 3
for i, (k, v, c) in enumerate(cols):
    cxx = bx0 + seg * i + seg / 2
    kw = d.textlength(k, font=font(26))
    d.text((cxx - kw/2, by0 + 18), k, font=font(26), fill=(150, 155, 160))
    vw = d.textlength(v, font=font(44, True))
    d.text((cxx - vw/2, by0 + 52), v, font=font(44, True), fill=c)

# OSM attribution (required, small)
at = "© OpenStreetMap"
aw = d.textlength(at, font=font(20))
d.text((W - aw - 18, H - 34), at, font=font(20), fill=(140, 145, 150, 220))

img.convert("RGB").save(OUTDIR / "shotMap.png")
print("shotMap.png written", img.size)
