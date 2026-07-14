#!/usr/bin/env python3
"""Extract Runvis app-screen SVGs from index.html, strip bezels, save screen-only SVG+HTML for PNG render."""
import re, os, pathlib

SRC = "/Users/curara/Developer/runvis-web/tools/screens-source.html"
OUT = pathlib.Path("/Users/curara/Downloads/Runvis_스크린_PNG")
OUT.mkdir(exist_ok=True)

html = open(SRC, encoding="utf-8").read()

# --- collect injected SVG strings: getElementById('X').innerHTML = '<svg ...>' ---
shots = {}
for m in re.finditer(r"getElementById\('(\w+)'\)(?:\s*&&\s*\(document\.getElementById\('\w+'\))?\.innerHTML\s*=\s*'(<svg.*?</svg>)'\)?;", html, re.S):
    shots[m.group(1)] = m.group(2).replace("\\n", "\n")

# hero watch svg (static markup)
hm = re.search(r'<svg class="watch" viewBox="0 0 330 400".*?</svg>', html, re.S)
if hm: shots["heroPace"] = hm.group(0).replace(' class="watch"', "")

print("found:", list(shots.keys()))

WATCH = {"shotHR", "shotPace", "shotMap", "heroPace"}
PHONE = {"shotDash", "shotDetail", "shotPlan", "shotRace"}

def screen_only(name, svg):
    if name in WATCH:
        # crop to screen area, drop bezel + crown rects
        svg = re.sub(r'<rect x="316"[^/]*/>', "", svg)
        svg = re.sub(r'<g stroke="#0c0c0d".*?</g>', "", svg, flags=re.S)
        svg = re.sub(r'<rect x="317"[^/]*/>', "", svg)
        svg = re.sub(r'<rect x="8" y="8" width="314" height="384" rx="60"[^/]*/>', "", svg)
        svg = svg.replace('viewBox="0 0 330 400"', 'viewBox="18 18 294 364"')
        w, h = 820, 1015  # ~Ultra 410x502 x2
    else:
        svg = re.sub(r'<rect x="4" y="4" width="292" height="612" rx="50"[^/]*/>', "", svg)
        svg = svg.replace('viewBox="0 0 300 620"', 'viewBox="12 12 276 596"')
        w, h = 828, 1788
    return svg, w, h

for name, svg in shots.items():
    s, w, h = screen_only(name, svg)
    svg_path = OUT / f"{name}.svg"
    svg_path.write_text(s, encoding="utf-8")
    page = f'<!doctype html><html><head><meta charset="utf-8"><style>*{{margin:0}}html,body{{background:#000}}svg{{display:block;width:{w}px;height:{h}px}}</style></head><body>{s}</body></html>'
    (OUT / f"{name}.html").write_text(page, encoding="utf-8")
    print(f"{name}: {w}x{h}")
print("done")
