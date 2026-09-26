#!/usr/bin/env python3
"""Generates the app and tray icons into resources/.

Everything is drawn at 4x and downsampled, which is the cheapest way to get
clean antialiased curves out of Pillow.

Each platform wants the tray mark in a different form:

  Linux    tray.png / tray@2x.png     light mark, for the dark GNOME top bar
  macOS    trayTemplate.png (+@2x)    black + alpha; macOS recolours it itself
  Windows  tray.ico / tray-dark.ico   two tones, because the notification area
                                      follows the system light/dark setting

Usage: python3 scripts/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

SS = 4  # supersampling factor
OUT = Path(__file__).resolve().parent.parent / "resources"

INDIGO = (99, 102, 241)
SKY = (56, 189, 248)

LIGHT_MARK = (255, 255, 255, 240)
DARK_MARK = (32, 33, 36, 240)
TEMPLATE_MARK = (0, 0, 0, 255)

# The sizes Windows picks between for the notification area, the alt-tab
# switcher, and high-DPI scaling.
TRAY_ICO_SIZES = [16, 20, 24, 32, 48, 64]
APP_ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]


def _lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def _ring(draw, box, width, fill, gap_degrees=44):
    """Draws a timer ring with a gap at the top."""
    start = -90 + gap_degrees / 2
    end = 270 - gap_degrees / 2
    draw.arc(box, start=start, end=end, fill=fill, width=width)


def _badge(size, radius_ratio, padding_ratio=0.0):
    """The gradient rounded square, optionally inset in a transparent canvas."""
    s = size * SS
    inset = round(s * padding_ratio)
    side = s - inset * 2

    gradient = Image.new("RGB", (side, side))
    gd = ImageDraw.Draw(gradient)
    for y in range(side):
        gd.line([(0, y), (side, y)], fill=_lerp(INDIGO, SKY, y / max(1, side - 1)))

    mask = Image.new("L", (side, side), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, side - 1, side - 1], radius=int(side * radius_ratio), fill=255
    )

    icon = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    icon.paste(gradient, (inset, inset), mask)

    d = ImageDraw.Draw(icon)
    ring_inset = inset + int(side * 0.27)
    _ring(
        d,
        [ring_inset, ring_inset, s - ring_inset, s - ring_inset],
        width=int(side * 0.075),
        fill=(255, 255, 255, 235),
    )

    # Centre dot — reads as the "now" marker on the dial.
    r = int(side * 0.052)
    c = s // 2
    d.ellipse([c - r, c - r, c + r, c + r], fill=(255, 255, 255, 235))

    return icon.resize((size, size), Image.LANCZOS)


def app_icon(size=512):
    """Full-bleed rounded square — the Linux icon shape, and the .ico source."""
    _badge(size, radius_ratio=0.23).save(OUT / "icon.png")
    return f"icon.png ({size}x{size})"


def app_icon_mac(size=1024):
    """
    macOS expects the artwork inset in a transparent canvas — roughly 824 px of
    content on a 1024 px tile — and a squircle-ish corner. A full-bleed icon
    sits visibly larger than everything else in the Dock.
    """
    _badge(size, radius_ratio=0.225, padding_ratio=0.098).save(OUT / "icon-mac.png")
    return f"icon-mac.png ({size}x{size})"


def app_icon_ico():
    """Windows reads the exe and shortcut icon out of a multi-size .ico."""
    base = _badge(max(APP_ICO_SIZES), radius_ratio=0.23)
    base.save(OUT / "icon.ico", format="ICO", sizes=[(s, s) for s in APP_ICO_SIZES])
    return f"icon.ico ({'/'.join(str(s) for s in APP_ICO_SIZES)})"


def _tray_glyph(size, fill):
    """The bare ring-and-dot mark, no background — one tray icon at one size."""
    s = size * SS
    icon = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(icon)

    inset = int(s * 0.12)
    _ring(d, [inset, inset, s - inset, s - inset], width=max(SS, int(s * 0.11)), fill=fill)

    r = max(SS, int(s * 0.075))
    c = s // 2
    d.ellipse([c - r, c - r, c + r, c + r], fill=fill)

    return icon.resize((size, size), Image.LANCZOS)


def tray_icon_png(size):
    """Light monochrome mark for the (dark) GNOME top bar."""
    name = "tray.png" if size == 32 else f"tray@{size // 32}x.png"
    _tray_glyph(size, LIGHT_MARK).save(OUT / name)
    return f"{name} ({size}x{size})"


def tray_icon_template(size):
    """
    macOS template image: pure black plus alpha. The system inverts it for the
    dark menu bar and tints it when the menu is open, so shipping a white mark
    here would give an invisible icon in light mode.
    """
    name = "trayTemplate.png" if size == 16 else f"trayTemplate@{size // 16}x.png"
    _tray_glyph(size, TEMPLATE_MARK).save(OUT / name)
    return f"{name} ({size}x{size})"


def tray_icon_ico(name, fill):
    base = _tray_glyph(max(TRAY_ICO_SIZES), fill)
    base.save(OUT / name, format="ICO", sizes=[(s, s) for s in TRAY_ICO_SIZES])
    return f"{name} ({'/'.join(str(s) for s in TRAY_ICO_SIZES)})"


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    written = [
        app_icon(512),
        app_icon_mac(1024),
        app_icon_ico(),
        tray_icon_png(32),
        tray_icon_png(64),
        tray_icon_template(16),
        tray_icon_template(32),
        # tray.ico is the light mark, for the usual dark taskbar; tray-dark.ico
        # is its counterpart for a light one.
        tray_icon_ico("tray.ico", LIGHT_MARK),
        tray_icon_ico("tray-dark.ico", DARK_MARK),
    ]
    for line in written:
        print("wrote", line)
