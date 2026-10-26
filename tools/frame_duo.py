#!/usr/bin/env python3
"""Frame an iPhone Duo inner-screen capture for the landing page.

    python3 tools/frame_duo.py <capture.png> <out-name>      # e.g. framed-duo-detail.en

WHERE THE CAPTURE COMES FROM. The real inner screen of the Duo simulator, opened flat
in its default landscape posture (951x669pt, 2853x2007px). The command line cannot
change the posture — the rotate / fold / unfold buttons live only at the bottom of the
Device Hub window — so open it there first, then (2026-10-26):

    xcrun simctl status_bar <Duo UDID> override --time 9:41 --batteryState charged \
        --batteryLevel 100 --wifiBars 3 --cellularMode notSupported
    xcrun simctl launch <Duo UDID> com.curara.SportsDashboard -RunvisDemo runDetail \
        -RunvisDemoBare YES -RunvisDemoScrubKm 3.1 -AppleLanguages "(en)" -AppleLocale en_KR
    xcrun simctl io <Duo UDID> screenshot --display=3 capture.png   # 3 = inner screen

An earlier version of these captures came from a 669x951 portrait canvas with a vertical
crease drawn down its middle. That was wrong twice over: the opened Duo is landscape by
default, and held in portrait its fold runs across, not down.

WHY OUR OWN FRAME. The phone mockups use Apple's official bezels (composite_bezels.py).
There is no Duo bezel in tools/bezel-donors, and drawing Apple's hardware from memory
would be imitation. This draws a plain dark device outline with a faint crease where the
fold actually is — the middle of the landscape screen (x 475.5 of 951pt, measured from
UIView.reservedRegions(kind: .division)). It says "folding phone" without pretending to
be a product photo.

Output: assets/<out-name>.png (palette PNG, dithered — see palette_png); then
`python3 tools/encode_shots.py` writes the AVIF/WebP pair.
"""
import pathlib
import sys

from PIL import Image, ImageDraw

WEB = pathlib.Path(__file__).resolve().parent.parent
SCREEN_W = 1120              # output width of the screen area, px (shown at ~560 CSS px)
BEZEL = 30                   # px
OUTER_R = 84                 # outer corner radius, px
SCREEN_R = 56
BODY = (28, 28, 30, 255)     # #1C1C1E — the app's control background
RIM = (255, 255, 255, 34)
FOLD_X = 475.5 / 951         # the fold, as a fraction of the landscape screen's width


def main(src: str, out_name: str):
    screen = Image.open(src).convert("RGBA")
    if screen.width < screen.height:
        raise SystemExit(f"{src} is portrait ({screen.width}x{screen.height}) — "
                         "rotate the Duo to landscape in Device Hub and capture again")
    sh = round(screen.height * SCREEN_W / screen.width)
    screen = screen.resize((SCREEN_W, sh), Image.LANCZOS)

    W, H = SCREEN_W + 2 * BEZEL, sh + 2 * BEZEL
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    d.rounded_rectangle((0, 0, W - 1, H - 1), OUTER_R, fill=BODY)
    d.rounded_rectangle((1, 1, W - 2, H - 2), OUTER_R - 1, outline=RIM, width=2)

    mask = Image.new("L", screen.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, screen.width - 1, screen.height - 1), SCREEN_R, fill=255)
    out.paste(screen, (BEZEL, BEZEL), mask)

    # The fold: a faint vertical crease where the hinge is. The app leaves the gap between
    # its two panes exactly over this line, so the crease never crosses text.
    crease = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cx = BEZEL + round(SCREEN_W * FOLD_X)
    ImageDraw.Draw(crease).line((cx, BEZEL, cx, H - BEZEL), fill=(255, 255, 255, 18), width=2)
    out = Image.alpha_composite(out, crease)

    path = WEB / "assets" / f"{out_name}.png"
    palette_png(out).save(path, optimize=True, transparency=255)
    print(f"wrote {path.relative_to(WEB)} {out.size[0]}x{out.size[1]}")


def palette_png(rgba: Image.Image) -> Image.Image:
    """255 dithered colours + one transparent slot for the corners outside the body.

    The other captures quantise without dithering (composite_lang.py) and that is fine at
    phone size, but at this width the summary card's green glow and the chart's gradient
    fill broke into visible blotches. Floyd-Steinberg over a median-cut palette keeps
    them smooth; the PNG is ~3x bigger (~230 KB) but the image is lazy-loaded and AVIF-
    capable browsers take the AVIF anyway.
    """
    rgb = Image.new("RGB", rgba.size, (0, 0, 0))
    rgb.paste(rgba, (0, 0), rgba)
    q = rgb.quantize(palette=rgb.quantize(255, method=Image.MEDIANCUT),
                     dither=Image.Dither.FLOYDSTEINBERG)
    clear = rgba.getchannel("A").point(lambda a: 255 if a < 128 else 0)
    q.paste(255, (0, 0), clear)
    q.putpalette(q.getpalette()[:255 * 3] + [0, 0, 0])
    return q


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
