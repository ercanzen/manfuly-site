"""Compose the Man Fu Ly brand files from the restaurant's bamboo symbol.

Input:  brand/symbol.svg (vector trace of content/source/logo-original.png)
        content/source/Fraunces-logo.ttf (static Fraunces instance for the wordmark)
Output: brand/*.svg and site/assets/brand/*.svg, site/favicon.svg
"""
import re
import shutil
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "brand"
SITE_BRAND = ROOT / "site" / "assets" / "brand"
GREEN, INK, PAPER = "#7E9D3F", "#1A1410", "#F5EFE4"

sym = (BRAND / "symbol.svg").read_text()
SW, SH = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', sym).groups())
SYM_PATHS = "".join(re.findall(r"<path [^>]*/>", sym))

font = TTFont(ROOT / "content" / "source" / "Fraunces-logo.ttf")
gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm


def text_path(txt, size, x, y, track=0.0):
    sc, adv, pen = size / upm, 0, SVGPathPen(gs)
    for ch in txt:
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (sc, 0, 0, -sc, x + adv * sc, y)))
        adv += gs[g].width + track * upm
    d = re.sub(r"-?\d+\.\d+", lambda m: f"{float(m.group()):.1f}", pen.getCommands())
    return d, (adv - track * upm) * sc


def symbol(x, y, h, badge=False):
    """Symbol centred in an h×h square slot."""
    s = h / SH
    ox = x + (h - SW * s) / 2
    out = ""
    if badge:  # cream disc so the white bamboo stays white on dark backgrounds
        out += f'<circle cx="{x + h / 2:.1f}" cy="{y + h / 2:.1f}" r="{h * 0.5:.1f}" fill="{PAPER}"/>'
    return out + f'<g transform="translate({ox:.1f} {y:.1f}) scale({s:.5f})" fill="{GREEN}">{SYM_PATHS}</g>'


def svg(w, h, body, label):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" role="img" aria-label="{label}">'
        f"<title>{label}</title>{body}</svg>\n"
    )


def lockup(text_color, badge):
    h = 120
    sw = h
    d1, w1 = text_path("Man Fu Ly", 74, sw + 26, 72, track=-0.02)
    d2, w2 = text_path("CHINA-RESTAURANT · GRENCHEN", 14.5, sw + 29, 104, track=0.16)
    body = symbol(0, 0, h, badge) + f'<path d="{d1}" fill="{text_color}"/><path d="{d2}" fill="{text_color}" opacity="0.72"/>'
    return svg(sw + 26 + max(w1, w2 + 3) + 2, h, body, "Man Fu Ly China-Restaurant Grenchen")


files = {
    "symbol.svg": svg(SH, SH, symbol(0, 0, SH), "Man Fu Ly"),
    "symbol-badge.svg": svg(SH, SH, symbol(0, 0, SH, badge=True), "Man Fu Ly"),
    "logo.svg": lockup(INK, False),
    "logo-invers.svg": lockup(PAPER, True),
}
SITE_BRAND.mkdir(parents=True, exist_ok=True)
for name, content in files.items():
    if name != "symbol.svg":
        (BRAND / name).write_text(content)
    (SITE_BRAND / name).write_text(content)
shutil.copy(SITE_BRAND / "symbol.svg", ROOT / "site" / "favicon.svg")
for old in ("seal.svg", "wordmark.svg"):
    for d in (BRAND, SITE_BRAND):
        (d / old).unlink(missing_ok=True)
print({n: len(c) for n, c in files.items()})
