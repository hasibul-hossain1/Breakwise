#!/usr/bin/env python3
"""Generates the app and tray icons into resources/.

Everything is drawn at 4x and downsampled, which is the cheapest way to get
clean antialiased curves out of Pillow.

Usage: python3 scripts/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

SS = 4  # supersampling factor
OUT = Path(__file__).resolve().parent.parent / "resources"

INDIGO = (99, 102, 241)
SKY = (56, 189, 248)


def _lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def _ring(draw, box, width, fill, gap_degrees=44):
    """Draws a timer ring with a gap at the top."""
    start = -90 + gap_degrees / 2
    end = 270 - gap_degrees / 2
    draw.arc(box, start=start, end=end, fill=fill, width=width)


def app_icon(size=512):
    s = size * SS
    # Diagonal-ish gradient background.
    gradient = Image.new("RGB", (s, s))
    gd = ImageDraw.Draw(gradient)
    for y in range(s):
        gd.line([(0, y), (s, y)], fill=_lerp(INDIGO, SKY, y / max(1, s - 1)))

    # Rounded-square mask, matching the modern Linux icon shape.
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.23), fill=255)

    icon = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    icon.paste(gradient, (0, 0), mask)

    d = ImageDraw.Draw(icon)
    inset = int(s * 0.27)
    _ring(d, [inset, inset, s - inset, s - inset], width=int(s * 0.075), fill=(255, 255, 255, 235))

    # Centre dot — reads as the "now" marker on the dial.
    r = int(s * 0.052)
    c = s // 2
    d.ellipse([c - r, c - r, c + r, c + r], fill=(255, 255, 255, 235))

    icon.resize((size, size), Image.LANCZOS).save(OUT / "icon.png")
    return f"icon.png ({size}x{size})"


def tray_icon(size):
    """Light monochrome mark for the (dark) GNOME top bar."""
    s = size * SS
    icon = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(icon)

    inset = int(s * 0.12)
    _ring(d, [inset, inset, s - inset, s - inset], width=max(SS, int(s * 0.11)), fill=(255, 255, 255, 240))

    r = max(SS, int(s * 0.075))
    c = s // 2
    d.ellipse([c - r, c - r, c + r, c + r], fill=(255, 255, 255, 240))

    name = "tray.png" if size == 32 else f"tray@{size // 32}x.png"
    icon.resize((size, size), Image.LANCZOS).save(OUT / name)
    return f"{name} ({size}x{size})"


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for line in [app_icon(512), tray_icon(32), tray_icon(64)]:
        print("wrote", line)
