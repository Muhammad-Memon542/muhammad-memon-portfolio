#!/usr/bin/env python3
"""
Generate the site's static image assets: the social-share card and the icon set.

These are committed to the repo, so you only need to re-run this after changing the
name, tagline, or palette. Requires Python 3 and Pillow (`pip install Pillow`).

    python3 scripts/generate-icons.py

Outputs:
    og-image.png            1200x630 social preview (Open Graph / Twitter)
    favicon.svg             scalable mark for modern browsers
    favicon.ico             16/32/48px fallback
    assets/icons/*.png      apple-touch-icon and PWA manifest icons

The card deliberately mirrors the site's own intro screen: night sky, low-poly sea,
the Home Harbor lighthouse, and the name set bottom-left over a scrim.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent

# Palette lifted from the site's night theme (see styles/base.css and src/main.js).
SKY_TOP = (6, 11, 34)
SKY_HORIZON = (40, 52, 98)
SEA_DEEP = (10, 30, 50)
SEA_SHALLOW = (23, 89, 108)
SAND = (198, 170, 118)
GRASS = (74, 106, 58)
GRASS_LIT = (96, 130, 72)
CREAM = (243, 237, 225)
RED = (199, 45, 60)
SIGNAL = (245, 197, 24)
INK = (6, 22, 34)

DISPLAY_FONT = "/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf"
BODY_FONTS = [
    "/System/Library/Fonts/Supplemental/Avenir Next.ttc",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
]


def load_font(path: str, size: int, index: int = 0):
    try:
        return ImageFont.truetype(path, size, index=index)
    except Exception:
        return None


def body_font(size: int, style: str = "Regular"):
    """Resolve a face by style name; .ttc collections bundle many weights per file."""
    for path in BODY_FONTS:
        for index in range(14):
            f = load_font(path, size, index)
            if f is None:
                break
            if f.getname()[1] == style:
                return f
        # fall back to the first face in this file before trying the next file
        f = load_font(path, size, 0)
        if f:
            return f
    return ImageFont.load_default()


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


# --------------------------------------------------------------------------- scene


def draw_sky(img: Image.Image, horizon: int) -> None:
    """Vertical gradient from deep space to a lit horizon, plus stars and a moon."""
    d = ImageDraw.Draw(img)
    for y in range(horizon):
        t = (y / horizon) ** 0.55
        d.line([(0, y), (img.width, y)], fill=lerp(SKY_TOP, SKY_HORIZON, t))

    rng = random.Random(20260918)
    for _ in range(220):
        x = rng.randrange(img.width)
        y = rng.randrange(int(horizon * 0.95))
        # fade stars out as they approach the bright horizon
        fade = 1 - (y / horizon) ** 1.6
        v = round((140 + rng.randrange(115)) * fade)
        if v <= 12:
            continue
        r = 1 if rng.random() < 0.82 else 2
        d.ellipse([x - r, y - r, x + r, y + r], fill=(v, v, min(255, v + 18)))


def draw_moon_glow(img: Image.Image, cx: int, cy: int) -> None:
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    for r, a in ((190, 26), (120, 34), (70, 46)):
        g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(150, 176, 255, a))
    g.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], fill=(226, 234, 255, 235))
    glow = glow.filter(ImageFilter.GaussianBlur(18))
    img.alpha_composite(glow)


def draw_sea(img: Image.Image, horizon: int) -> None:
    """Sea gradient with faint low-poly facet banding, echoing the flat-shaded water."""
    d = ImageDraw.Draw(img)
    h = img.height
    for y in range(horizon, h):
        t = (y - horizon) / max(1, h - horizon)
        near = lerp(SKY_HORIZON, SEA_SHALLOW, min(1.0, t * 3.2))
        d.line([(0, y), (img.width, y)], fill=lerp(near, SEA_DEEP, t**0.7))

    # facets: rows of wide triangles, slightly lighter/darker than the water beneath
    rng = random.Random(7)
    facets = Image.new("RGBA", img.size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(facets)
    y = horizon
    row = 0
    while y < h:
        depth = (y - horizon) / max(1, h - horizon)
        step = int(46 + depth * 150)
        band = int(12 + depth * 46)
        x = -step
        while x < img.width + step:
            up = (row + (x // max(1, step))) % 2 == 0
            if up:
                pts = [(x, y + band), (x + step, y + band), (x + step // 2, y)]
            else:
                pts = [(x, y), (x + step, y), (x + step // 2, y + band)]
            a = rng.randrange(6, 20)
            tint = (150, 200, 225, a) if rng.random() < 0.55 else (0, 12, 28, a + 6)
            fd.polygon(pts, fill=tint)
            x += step
        y += band
        row += 1
    img.alpha_composite(facets)


def draw_lighthouse(d: ImageDraw.ImageDraw, cx: int, base_y: int, s: float) -> None:
    """The Home Harbor lighthouse: tapered striped tower, lantern room, cap."""
    h = 150 * s
    top_w, bot_w = 22 * s, 38 * s
    bands = 5
    for i in range(bands):
        t0, t1 = i / bands, (i + 1) / bands
        y0, y1 = base_y - h * t1, base_y - h * t0
        w0 = bot_w + (top_w - bot_w) * t1
        w1 = bot_w + (top_w - bot_w) * t0
        color = RED if i % 2 == 0 else CREAM
        d.polygon(
            [(cx - w1 / 2, y1), (cx + w1 / 2, y1), (cx + w0 / 2, y0), (cx - w0 / 2, y0)],
            fill=color,
        )
    ty = base_y - h
    # gallery deck
    d.rectangle([cx - top_w * 0.95, ty - 5 * s, cx + top_w * 0.95, ty], fill=(32, 40, 52))
    # lantern room
    d.rectangle([cx - top_w * 0.55, ty - 26 * s, cx + top_w * 0.55, ty - 5 * s], fill=SIGNAL)
    # roof
    d.polygon(
        [(cx - top_w * 0.95, ty - 26 * s), (cx + top_w * 0.95, ty - 26 * s), (cx, ty - 48 * s)],
        fill=RED,
    )


def draw_island(img: Image.Image, cx: int, water_y: int, w: int, lighthouse: bool) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    h = w * 0.30
    # sand shelf
    d.polygon(
        [(cx - w / 2, water_y), (cx + w / 2, water_y),
         (cx + w * 0.33, water_y - h * 0.48), (cx - w * 0.33, water_y - h * 0.48)],
        fill=SAND,
    )
    # grass cap (two tones for a faceted look)
    gy = water_y - h * 0.44
    d.polygon(
        [(cx - w * 0.34, gy), (cx + w * 0.34, gy),
         (cx + w * 0.20, gy - h * 0.52), (cx - w * 0.22, gy - h * 0.52)],
        fill=GRASS,
    )
    d.polygon(
        [(cx - w * 0.22, gy - h * 0.52), (cx + w * 0.20, gy - h * 0.52), (cx - w * 0.02, gy)],
        fill=GRASS_LIT,
    )
    top_y = gy - h * 0.50

    if lighthouse:
        draw_lighthouse(d, cx, top_y + 4, w / 300)
        # trees flanking the tower
        for tx, ts in ((-0.27, 0.9), (0.24, 1.0), (0.31, 0.7)):
            x = cx + w * tx
            th = 34 * ts * (w / 300)
            d.polygon([(x, top_y - th), (x - th * 0.36, top_y + 6), (x + th * 0.36, top_y + 6)],
                      fill=(38, 74, 48))
    img.alpha_composite(layer)


def draw_beam(img: Image.Image, cx: int, cy: int) -> None:
    beam = Image.new("RGBA", img.size, (0, 0, 0, 0))
    b = ImageDraw.Draw(beam)
    b.polygon([(cx, cy), (img.width + 80, cy - 130), (img.width + 80, cy + 95)], fill=(255, 226, 150, 30))
    b.polygon([(cx, cy), (-80, cy - 60), (-80, cy + 30)], fill=(255, 226, 150, 12))
    img.alpha_composite(beam.filter(ImageFilter.GaussianBlur(9)))


def draw_boat(img: Image.Image, cx: int, base_y: int, s: float) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    hull_w, hull_h = 54 * s, 13 * s
    mast_h = 62 * s
    d.polygon([(cx, base_y - mast_h), (cx, base_y - 6 * s), (cx + 30 * s, base_y - 6 * s)], fill=CREAM)
    d.polygon([(cx - 2 * s, base_y - mast_h * 0.86), (cx - 2 * s, base_y - 6 * s),
               (cx - 24 * s, base_y - 6 * s)], fill=(228, 220, 205))
    d.polygon([(cx - hull_w / 2, base_y - hull_h), (cx + hull_w / 2, base_y - hull_h),
               (cx + hull_w / 2 - 9 * s, base_y), (cx - hull_w / 2 + 9 * s, base_y)],
              fill=(26, 52, 78))
    img.alpha_composite(layer)


def draw_scrim(img: Image.Image) -> None:
    """Bottom-up dark gradient so the type stays legible, as on the site's intro."""
    scrim = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(scrim)
    for y in range(img.height):
        t = y / img.height
        a = 0 if t < 0.28 else int(215 * ((t - 0.28) / 0.72) ** 1.35)
        d.line([(0, y), (img.width, y)], fill=(*INK, a))
    img.alpha_composite(scrim)


def tracked_text(d: ImageDraw.ImageDraw, xy, text: str, font, fill, tracking: float = 0.0):
    """Draw text with manual letter-spacing (PIL has no tracking support)."""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + tracking
    return x


# --------------------------------------------------------------------- deliverables


def build_og_image() -> Path:
    W, H, HORIZON = 1200, 630, 330
    img = Image.new("RGBA", (W, H), SKY_TOP)
    draw_sky(img, HORIZON)
    draw_moon_glow(img, 985, 118)
    draw_sea(img, HORIZON)

    # distant islands sit near the horizon, the hero island closer and lower
    draw_island(img, 205, HORIZON + 26, 120, lighthouse=False)
    draw_island(img, 1075, HORIZON + 44, 150, lighthouse=False)
    draw_beam(img, 880, 352)
    draw_island(img, 880, HORIZON + 132, 300, lighthouse=True)

    draw_scrim(img)
    # the boat is foreground, so it goes on top of the scrim and stays crisp
    draw_boat(img, 1104, HORIZON + 232, 1.05)

    d = ImageDraw.Draw(img)
    eyebrow = body_font(25, "Demi Bold")
    name_font = load_font(DISPLAY_FONT, 132) or body_font(120, "Bold")
    tag_font = body_font(29, "Medium")

    tracked_text(d, (72, 392), "STATISTICS & MACHINE LEARNING", eyebrow, (226, 236, 240, 235), 2.6)
    d.text((66, 424), "Muhammad Memon", font=name_font, fill=(255, 255, 255, 255))
    d.text((72, 556), "An explorable 3D portfolio — sail between the islands.",
           font=tag_font, fill=(214, 228, 235, 232))

    # signal-yellow rule tying the card to the site's accent
    d.rectangle([72, 378, 148, 382], fill=(*SIGNAL, 255))

    out = ROOT / "og-image.png"
    img.convert("RGB").save(out, "PNG", optimize=True)
    return out


def build_icon(size: int) -> Image.Image:
    """Lighthouse mark on a navy rounded square — legible down to 16px."""
    ss = 8  # supersample for clean edges
    s = size * ss
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=(15, 35, 49))

    cx = s / 2
    base_y = s * 0.845
    h = s * 0.52
    top_w, bot_w = s * 0.185, s * 0.33
    for i in range(4):
        t0, t1 = i / 4, (i + 1) / 4
        y0, y1 = base_y - h * t1, base_y - h * t0
        w0 = bot_w + (top_w - bot_w) * t1
        w1 = bot_w + (top_w - bot_w) * t0
        d.polygon([(cx - w1 / 2, y1), (cx + w1 / 2, y1), (cx + w0 / 2, y0), (cx - w0 / 2, y0)],
                  fill=RED if i % 2 == 0 else CREAM)
    ty = base_y - h
    d.rectangle([cx - top_w * 0.92, ty - s * 0.022, cx + top_w * 0.92, ty], fill=(20, 28, 38))
    d.rectangle([cx - top_w * 0.5, ty - s * 0.105, cx + top_w * 0.5, ty - s * 0.022], fill=SIGNAL)
    d.polygon([(cx - top_w * 0.92, ty - s * 0.105), (cx + top_w * 0.92, ty - s * 0.105),
               (cx, ty - s * 0.19)], fill=RED)
    # ground line
    d.rectangle([s * 0.17, base_y, s * 0.83, base_y + s * 0.035], fill=(74, 106, 58))
    return img.resize((size, size), Image.LANCZOS)


FAVICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Lighthouse">
  <rect width="64" height="64" rx="14" fill="#0f2331"/>
  <rect x="11" y="52" width="42" height="3" rx="1.5" fill="#4a6a3a"/>
  <path d="M21.5 52 L24 20 L40 20 L42.5 52 Z" fill="#f3ede1"/>
  <path d="M21.5 52 L22.3 42 L41.7 42 L42.5 52 Z" fill="#c72d3c"/>
  <path d="M23.2 31 L40.8 31 L41.4 41 L22.6 41 Z" fill="#c72d3c"/>
  <rect x="22.5" y="17.5" width="19" height="3" rx="1" fill="#141c26"/>
  <rect x="26" y="11" width="12" height="6.5" fill="#f5c518"/>
  <path d="M22.5 11 L41.5 11 L32 4 Z" fill="#c72d3c"/>
</svg>
"""


def main() -> None:
    (ROOT / "assets" / "icons").mkdir(parents=True, exist_ok=True)

    og = build_og_image()
    print(f"wrote {og.relative_to(ROOT)} ({og.stat().st_size // 1024} KB)")

    (ROOT / "favicon.svg").write_text(FAVICON_SVG)
    print("wrote favicon.svg")

    base = build_icon(512)
    for name, size in (("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)):
        path = ROOT / "assets" / "icons" / name
        (base if size == 512 else build_icon(size)).save(path, "PNG", optimize=True)
        print(f"wrote {path.relative_to(ROOT)}")

    ico = ROOT / "favicon.ico"
    build_icon(48).save(ico, sizes=[(16, 16), (32, 32), (48, 48)])
    print("wrote favicon.ico")


if __name__ == "__main__":
    main()
