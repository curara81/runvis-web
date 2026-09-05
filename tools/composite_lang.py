#!/usr/bin/env python3
"""Composite localized simulator screenshots into the SAME Apple bezel the
Korean captures already wear, without re-downloading the bezel DMGs.

Why a "donor" instead of `composite_bezels.py`: that script needs the raw
Apple bezel PNGs (300 MB DMGs, not redistributable, not in this repo). The
already-shipped `assets/framed-*.png` ARE that bezel with a screen in it, so
we reuse one of them as the donor and repaint only the glass.

Geometry is not guessed. `fit_geometry()` (kept below, run with --fit) solves
scale+offset by normalized cross-correlation between a fresh Korean capture
and the shipped Korean frame; both the status-bar band and the tab-bar band
agree on the same answer:

    iPhone  1206x2622 -> 560x1218 at (40, 64)   in the 640x1308 frame
    Watch    422x514  -> 325x396  at (79, 178)  in the 480x768  frame

The screen mask is a rounded rect, and the top band is re-lightened from the
donor afterwards so the bezel's glass-reflection streak (drawn ON TOP of the
screen in Apple's PNG) survives the repaint. iOS/watchOS draw black there, so
`max()` can only restore the bezel, never erase app pixels.

Usage:
    python3 tools/composite_lang.py            # build everything in SHOTS
    python3 tools/composite_lang.py --fit ko   # re-derive the geometry
"""
import pathlib
import sys

from PIL import Image, ImageChops, ImageDraw

WEB = pathlib.Path(__file__).resolve().parent.parent
ASSETS = WEB / "assets"
SHOTS = pathlib.Path(
    "/private/tmp/claude-501/-Users-curara/"
    "40643633-3eb0-480b-98bb-ba8f6961e302/scratchpad/shots"
)

# donor frame, screen box (l, t, r, b) in donor pixels, corner radius, top band
PHONE = dict(donor="framed-phone-dash.png", box=(40, 64, 600, 1282), radius=50,
             lighten_to=106)
WATCH = dict(donor="framed-watch-hero.png", box=(79, 178, 404, 574), radius=58,
             lighten_to=200)

PHONE_SCREENS = ["dash", "detail", "glance", "plan", "race"]
WATCH_SCREENS = ["hero", "evidence", "start", "pace", "hr", "map"]
# capture-side locale -> site language code (t-*.js / ?lang=). The site calls
# Traditional Chinese "zh"; the app bundle calls it "zh-Hant".
LANGS = {"en": "en", "ja": "ja", "es": "es", "zh-Hant": "zh", "de": "de", "ko": ""}


def rounded_mask(size, box, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=radius, fill=255)
    return m


def compose(shot_path, spec, out_path):
    donor = Image.open(ASSETS / spec["donor"]).convert("RGBA")
    l, t, r, b = spec["box"]
    shot = Image.open(shot_path).convert("RGBA").resize((r - l, b - t), Image.LANCZOS)
    canvas = Image.new("RGBA", donor.size, (0, 0, 0, 255))
    canvas.paste(shot, (l, t))
    out = Image.composite(canvas, donor, rounded_mask(donor.size, (l, t, r - 1, b - 1),
                                                      spec["radius"]))
    # Restore bezel detail drawn over the glass (reflection streak). Only the
    # top band, where the OS paints black anyway, so this cannot hide app UI.
    band = (l, t, r, spec["lighten_to"])
    out.paste(ImageChops.lighter(out.crop(band), donor.crop(band)), band)
    # Ship PNG8 like the Korean originals (58KB, not 300KB): FASTOCTREE is the
    # one PIL quantizer that carries alpha into the palette, which the bezel's
    # anti-aliased outline needs.
    out.quantize(colors=256, method=Image.FASTOCTREE).save(out_path, optimize=True)
    return out_path.stat().st_size


def build():
    made = []
    for lang, code in LANGS.items():
        for name in PHONE_SCREENS:
            src = SHOTS / f"{name}.{lang}.png"
            if not src.exists():
                continue
            suffix = f".{code}" if code else ""
            out = ASSETS / f"framed-phone-{name}{suffix}.png"
            made.append((out.name, compose(src, PHONE, out)))
        for name in WATCH_SCREENS:
            src = SHOTS / f"w-{name}.{lang}.png"
            if not src.exists():
                continue
            suffix = f".{code}" if code else ""
            out = ASSETS / f"framed-watch-{name}{suffix}.png"
            made.append((out.name, compose(src, WATCH, out)))
    for n, s in made:
        print(f"{n}  {s // 1024}KB")
    print(f"{len(made)} files")


def fit_geometry(lang="ko", kind="phone"):
    """Solve scale+offset against the shipped Korean frame (documentation of
    where the numbers at the top came from; needs numpy+scipy)."""
    import numpy as np
    from scipy.signal import fftconvolve
    spec = PHONE if kind == "phone" else WATCH
    name = "dash" if kind == "phone" else "hero"
    src = SHOTS / (f"{name}.{lang}.png" if kind == "phone" else f"w-{name}.{lang}.png")
    don = np.asarray(Image.open(ASSETS / spec["donor"]).convert("RGBA").convert("L"),
                     dtype=float)
    shot = Image.open(src).convert("L")
    W, H = shot.size

    def ncc(img, tpl):
        tt = tpl - tpl.mean()
        num = fftconvolve(img, tt[::-1, ::-1], mode="valid")
        ones = np.ones_like(tt)
        s1 = fftconvolve(img, ones, mode="valid")
        s2 = fftconvolve(img * img, ones, mode="valid")
        var = s2 - s1 * s1 / tt.size
        var[var < 1e-6] = 1e-6
        return num / (np.sqrt(var) * np.sqrt((tt * tt).sum()))

    best = None
    for i in range(400, 620):
        s = i / 1000
        w, h = round(W * s), round(H * s)
        if w >= don.shape[1] or h >= don.shape[0]:
            continue
        sm = np.asarray(shot.resize((w, h), Image.LANCZOS), dtype=float)
        tpl = sm[20:70, :]
        rr = ncc(don, tpl)
        idx = np.unravel_index(rr.argmax(), rr.shape)
        v = float(rr[idx])
        if best is None or v > best[0]:
            best = (v, s, int(idx[0]) - 20, int(idx[1]), w, h)
    print(f"peak={best[0]:.4f} scale={best[1]} offset=({best[3]},{best[2]}) "
          f"size={best[4]}x{best[5]}")


if __name__ == "__main__":
    if "--fit" in sys.argv:
        fit_geometry(kind=sys.argv[-1] if sys.argv[-1] in ("phone", "watch") else "phone")
    else:
        build()
