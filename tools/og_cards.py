#!/usr/bin/env python3
"""Draw assets/og-card.<code>.png — one link-preview card per market.

    python3 tools/og_cards.py            # write all six cards
    python3 tools/og_cards.py --check    # exit 1 if a card is missing/stale

WHY. og:image was the same wordless card for all six markets: a mark, a watch,
a pulse and the domain, and nothing a reader could tell apart in a feed
(2026-09-06 라운드 14, -0.3). tools/prerender.mjs (step 8b) has pointed a
market's og:image at assets/og-card.<code>.png "the moment that file exists"
since round 13 — the wiring was there and the files were not. This draws them.

WHAT IS DRAWN. The neutral card is the background, unchanged: the wordmark, the
rule and runvis.app stay where they are, because the card is also the Korean
card and the shape people already saw. Added under them is the one sentence the
market's own page leads with — n.hero.h1 out of t-<code>.js, tags stripped —
so the two cannot say different things. Nothing is painted over: the sentence
goes in the empty lower-left quadrant, which is why the layout survives a
headline of any of the six lengths.

FONTS are the system's, chosen per script, because one face does not cover
Hangul, kana and Traditional Han: a missing glyph renders as a blank box and a
blank box in a link preview is worse than no card. `--check` verifies the file
exists and is newer than the dictionary it was drawn from, so a reworded
headline shows up as stale rather than as a card that quietly disagrees with
the page it links to.
"""
import json
import os
import pathlib
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont, PngImagePlugin

WEB = pathlib.Path(__file__).resolve().parent.parent
ASSETS = WEB / "assets"
# The neutral card is the BACKGROUND, and it lives in tools/ rather than in
# assets/ for the same reason tools/bezel-donors/ does: assets/og-card.png is
# now an OUTPUT of this script (the Korean card), and drawing generation N+1 on
# top of generation N would stack the sentence on itself.
BASE_CARD = WEB / "tools" / "og-card-base.png"

# One face per script. Index picks the weight inside the .ttc.
FONTS = {
    "ko": ("/System/Library/Fonts/AppleSDGothicNeo.ttc", 6),          # Bold
    "ja": ("/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc", 0),      # Hiragino Sans W6
    "zh": ("/System/Library/Fonts/STHeiti Medium.ttc", 0),            # Heiti TC Medium
    "en": ("/System/Library/Fonts/HelveticaNeue.ttc", 1),             # Bold
    "es": ("/System/Library/Fonts/HelveticaNeue.ttc", 1),
    "de": ("/System/Library/Fonts/HelveticaNeue.ttc", 1),
}

# The empty lower-left quadrant of the neutral card. The watch art starts around
# x=700, and runvis.app's baseline sits at about y=440.
BOX = (96, 486, 660, 596)          # left, top, right, bottom
LINE_GAP = 8
MAX_SIZE, MIN_SIZE = 46, 30
INK = (242, 243, 245)
# The headline is stamped into the PNG so --check can compare words, not dates.
TEXT_KEY = "Runvis-Headline"


def card_path(code):
    """Korean is the root page's og:image, which is assets/og-card.png."""
    return ASSETS / ("og-card.png" if code == "ko" else f"og-card.{code}.png")


def headlines():
    """{code: plain-text n.hero.h1}, read out of the six dictionaries."""
    script = (
        "globalThis.window={};"
        "const c=['ko','en','ja','es','zh','de'];"
        "(async()=>{for(const x of c)await import('file://%s/t-'+x+'.js');"
        "const d=globalThis.window.RUNVIS_I18N;"
        "console.log(JSON.stringify(Object.fromEntries(c.map(x=>[x,d[x]['n.hero.h1']]))));})()"
        % WEB
    )
    raw = subprocess.run(["node", "--input-type=module", "-e", script],
                         capture_output=True, text=True, check=True).stdout
    out = {}
    for code, html in json.loads(raw).items():
        text = re.sub(r"<[^>]*>", " ", html)
        text = re.sub(r"\s+", " ", text).strip()
        # <br/> became a space, which is right in Korean and wrong in Japanese
        # and Chinese: "Apple Watchが あれば十分です" is not how that sentence is
        # written. Drop a space only when both sides of it are kana or Han.
        out[code] = re.sub(f"({CJK.pattern}) ({CJK.pattern})", r"\1\2", text)
    return out


CJK = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]")


def chunks(text):
    """Break candidates: after a space, and between two CJK characters.

    Splitting on spaces alone put "Apple / Watchがあれば十分です" on the Japanese
    card — the only ASCII space in the sentence was the only place it could
    break, and it is the one place a Japanese reader would not.
    """
    out, cur = [], ""
    for i, ch in enumerate(text):
        if ch == " ":
            if cur:
                out.append(cur + " ")
            cur = ""
            continue
        cur += ch
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if CJK.match(ch) and CJK.match(nxt or " "):
            out.append(cur)
            cur = ""
    if cur:
        out.append(cur)
    return out


def wrap(draw, text, font, width):
    lines, cur = [], ""
    for piece in chunks(text):
        trial = cur + piece
        if draw.textlength(trial.rstrip(), font=font) <= width or not cur:
            cur = trial
        else:
            lines.append(cur.rstrip())
            cur = piece
    if cur.strip():
        lines.append(cur.rstrip())
    return lines


def layout(d, text, path, index, width, height):
    """Largest size that fits on ONE line; failing that, largest that fits two.

    One line first, because a headline broken mid-phrase reads as a mistake in
    a feed, and shrinking two points is cheaper than that.
    """
    for max_lines in (1, 2):
        for size in range(MAX_SIZE, MIN_SIZE - 1, -2):
            font = ImageFont.truetype(path, size, index=index)
            lines = wrap(d, text, font, width)
            block = len(lines) * (size + LINE_GAP) - LINE_GAP
            if len(lines) <= max_lines and block <= height:
                return font, lines, size
    font = ImageFont.truetype(path, MIN_SIZE, index=index)
    return font, wrap(d, text, font, width)[:2], MIN_SIZE


def draw_card(code, text):
    card = Image.open(BASE_CARD).convert("RGB")
    d = ImageDraw.Draw(card)
    left, top, right, bottom = BOX
    path, index = FONTS[code]
    font, lines, size = layout(d, text, path, index, right - left, bottom - top)
    y = top
    for line in lines:
        d.text((left, y), line, font=font, fill=INK)
        y += size + LINE_GAP
    return card


def main(argv):
    if not BASE_CARD.exists():
        print(f"og_cards: {BASE_CARD} is missing — it is the background")
        return 1
    # All six by default: the ROOT is the Korean page and its og:image is
    # assets/og-card.png, so leaving Korean out would have been the one market
    # still sharing a card with no sentence on it.
    codes = list(FONTS)
    texts = headlines()

    if "--check" in argv:
        # Compare the sentence, not the file date. A dictionary is edited many
        # times a round and n.hero.h1 almost never; a timestamp check called
        # every one of those a stale card. Each PNG carries the headline it was
        # drawn with in a tEXt chunk, so this asks the file what it says.
        bad = []
        for c in codes:
            out = card_path(c)
            if not out.exists():
                bad.append(f"{out.name} missing")
                continue
            with Image.open(out) as im:
                drawn = (im.text or {}).get(TEXT_KEY)
            if drawn is None:
                bad.append(f"{out.name} was not drawn by this script")
            elif drawn != texts[c]:
                bad.append(f"{out.name} says “{drawn}”, n.hero.h1 says “{texts[c]}”")
        if bad:
            print("og_cards: " + "; ".join(bad) + "\n  run: python3 tools/og_cards.py")
            return 1
        print(f"og_cards: {len(codes)} market cards present, each carrying its own n.hero.h1")
        return 0

    for c in codes:
        out = card_path(c)
        meta = PngImagePlugin.PngInfo()
        meta.add_text(TEXT_KEY, texts[c])
        draw_card(c, texts[c]).save(out, "PNG", optimize=True, pnginfo=meta)
        print(f"  {out.name}  “{texts[c]}”  {os.path.getsize(out) // 1024} KB")
    print(f"og_cards: {len(codes)} card(s) written — run `node tools/prerender.mjs` to point og:image at them")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
