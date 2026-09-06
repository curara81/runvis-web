#!/usr/bin/env python3
"""Write an AVIF and a WebP next to every assets/framed-*.png.

    python3 tools/encode_shots.py            # encode everything that is stale
    python3 tools/encode_shots.py --force    # re-encode all 66
    python3 tools/encode_shots.py --check    # exit 1 if any PNG has no pair

WHY. index.html referenced eleven device captures and every one of them was a
PNG; assets/ was 3.4 MB and a phone on a slow connection paid ~600 KB for one
page, LCP image included (2026-09-06 라운드 14, -0.8). The captures are UI
screenshots — flat colour, hard edges, small text — which is the case AVIF is
best at: the whole set drops to ~50% of the PNG bytes with no visible change to
the type. The markup asks for them through <picture>, so a browser that cannot
decode AVIF never sees the file.

Two formats, for two different reasons:

  * AVIF, lossy q62. Half the bytes. Safari 16+, Chrome 85+, Firefox 93+.
  * WebP, LOSSLESS. Not a quality decision — a size one. These PNGs are already
    palette-quantised (mode "P", <=256 colours), and lossy WebP over a quantised
    source came out BIGGER than the PNG at every quality that kept the text
    clean (q88 -> 104% of the PNG). Lossless WebP over the same palette is 86%,
    is pixel-identical to the PNG, and is the only thing here that helps the
    Safari 14-15 window between "no AVIF" and "no WebP either". A fallback that
    costs more bytes than the thing it falls back from is not a fallback, which
    is why this file says which setting was measured and what it measured.

The PNG stays and stays first in the pipeline: it is what <img src> names, what
og:image points at (link-preview crawlers are not browsers), and what
tools/composite_lang.py reads and writes. This script only ever ADDS files.
"""
import glob
import os
import sys
import pathlib

from PIL import Image

WEB = pathlib.Path(__file__).resolve().parent.parent
AVIF_QUALITY = 62          # measured: text stays crisp at 640x1308 and 480x768
WEBP_LOSSLESS = True


def pairs():
    for png in sorted(glob.glob(str(WEB / "assets" / "framed-*.png"))):
        base = png[:-4]
        yield png, base + ".avif", base + ".webp"


def stale(src, out):
    return not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(src)


def main(argv):
    force = "--force" in argv
    check = "--check" in argv
    missing, wrote = [], 0
    total_png = total_avif = total_webp = 0
    for png, avif, webp in pairs():
        total_png += os.path.getsize(png)
        if check:
            if stale(png, avif) or stale(png, webp):
                missing.append(os.path.basename(png))
            continue
        if force or stale(png, avif) or stale(png, webp):
            im = Image.open(png).convert("RGBA")
            im.save(avif, "AVIF", quality=AVIF_QUALITY, speed=4)
            im.save(webp, "WEBP", lossless=WEBP_LOSSLESS, method=6)
            wrote += 1
        total_avif += os.path.getsize(avif)
        total_webp += os.path.getsize(webp)

    if check:
        if missing:
            print(f"encode_shots: {len(missing)} capture(s) have no current AVIF/WebP — "
                  f"{', '.join(missing[:6])}{' …' if len(missing) > 6 else ''}\n"
                  f"  run: python3 tools/encode_shots.py")
            return 1
        print("encode_shots: every framed-*.png has a current .avif and .webp")
        return 0

    print(f"encode_shots: {wrote} re-encoded, {len(list(pairs()))} pairs total")
    print(f"  png  {total_png / 1024:7.0f} KB")
    print(f"  avif {total_avif / 1024:7.0f} KB  ({100 * total_avif / total_png:.0f}%)")
    print(f"  webp {total_webp / 1024:7.0f} KB  ({100 * total_webp / total_png:.0f}%)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
