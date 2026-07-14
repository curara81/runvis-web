#!/usr/bin/env python3
"""Composite Runvis screen PNGs into Apple official bezel images.

The bezel PNGs ship with a fully transparent screen cutout; we find that
hole's bounding box from the alpha channel (largest interior transparent
region), scale our screen render to cover it, and paste the screen UNDER
the bezel so the bezel's rounded corners/anti-aliasing mask the screen.
"""
import sys, pathlib
from PIL import Image

SP = pathlib.Path("/private/tmp/claude-501/-Users-curara/6a20ea08-55b5-403e-80c6-30358cc841b7/scratchpad")
SRC = pathlib.Path("/Users/curara/Downloads/Runvis_스크린_PNG")
OUT = pathlib.Path("/Users/curara/Developer/runvis-web/assets")
OUT.mkdir(exist_ok=True)

def screen_bbox(bezel: Image.Image):
    """BBox of the transparent screen hole: alpha==0 pixels well inside the
    image (bezels are also transparent OUTSIDE the device outline, so probe
    from the image center outward instead of taking a global alpha bbox)."""
    a = bezel.getchannel("A")
    w, h = a.size
    px = a.load()
    cx, cy = w // 2, h // 2
    assert px[cx, cy] == 0, "center is not transparent — unexpected bezel layout"
    # flood-expand a rectangle from center while its EDGES stay fully transparent
    left, right, top, bot = cx, cx, cy, cy
    def col_clear(x, y0, y1): return all(px[x, y] == 0 for y in range(y0, y1 + 1))
    def row_clear(y, x0, x1): return all(px[x, y] == 0 for x in range(x0, x1 + 1))
    changed = True
    while changed:
        changed = False
        if left > 0 and col_clear(left - 1, top, bot): left -= 1; changed = True
        if right < w - 1 and col_clear(right + 1, top, bot): right += 1; changed = True
        if top > 0 and row_clear(top - 1, left, right): top -= 1; changed = True
        if bot < h - 1 and row_clear(bot + 1, left, right): bot += 1; changed = True
    # The inscribed rect stops short of the hole's TRUE vertical extent: the
    # rounded screen corners (and the iPhone's Dynamic Island, an opaque blob
    # top-center) block full-width rows. Re-probe a single column at 30% of
    # the hole width — past the corner arc, left of the island — and walk it
    # to the real top/bottom edges of the glass.
    xp = left + int((right - left) * 0.30)
    true_top, true_bot = top, bot
    while true_top > 0 and px[xp, true_top - 1] == 0: true_top -= 1
    while true_bot < h - 1 and px[xp, true_bot + 1] == 0: true_bot += 1
    return left, true_top, right + 1, true_bot + 1

def frame(shot_name: str, bezel_path: str, out_name: str, out_width: int, bleed: int = 4):
    bezel = Image.open(SP / bezel_path).convert("RGBA")
    shot = Image.open(SRC / f"{shot_name}.png").convert("RGBA")
    l, t, r, b = screen_bbox(bezel)
    # bleed: overscan the screen a few px past the hole so no gap shows at
    # the anti-aliased rim
    l -= bleed; t -= bleed; r += bleed; b += bleed
    sw, sh = r - l, b - t
    # cover-fit (crop overflow) so aspect mismatch never letterboxes
    scale = max(sw / shot.width, sh / shot.height)
    shot = shot.resize((round(shot.width * scale), round(shot.height * scale)), Image.LANCZOS)
    ox = l - (shot.width - sw) // 2
    oy = t - (shot.height - sh) // 2
    canvas = Image.new("RGBA", bezel.size, (0, 0, 0, 0))
    canvas.paste(shot, (ox, oy))
    # clip screen to the hole region + bleed (avoid screen spilling behind
    # transparent OUTER background of the bezel)
    mask = Image.new("L", bezel.size, 0)
    mask.paste(255, (l, t, r, b))
    clipped = Image.new("RGBA", bezel.size, (0, 0, 0, 0))
    clipped.paste(canvas, (0, 0), mask)
    result = Image.alpha_composite(clipped, bezel)
    ratio = out_width / result.width
    result = result.resize((out_width, round(result.height * ratio)), Image.LANCZOS)
    result.save(OUT / out_name, optimize=True)
    print(f"{out_name}: hole=({l},{t},{r},{b}) out={result.size} "
          f"{(OUT / out_name).stat().st_size // 1024}KB")

# Watch shots → Ultra 3 bezel
for shot, out in [("shotHR", "framed-watch-hr.png"),
                  ("shotPace", "framed-watch-pace.png"),
                  ("shotMap", "framed-watch-map.png"),
                  ("heroPace", "framed-watch-hero.png")]:
    frame(shot, "bezel-ultra.png", out, 480)

# Phone shots → iPhone 17 bezel
for shot, out in [("shotDash", "framed-phone-dash.png"),
                  ("shotDetail", "framed-phone-detail.png"),
                  ("shotPlan", "framed-phone-plan.png"),
                  ("shotRace", "framed-phone-race.png")]:
    frame(shot, "bezel-iphone.png", out, 640)

print("done")
