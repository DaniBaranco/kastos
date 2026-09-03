#!/usr/bin/env python3
"""Genera los iconos PNG de Kastos v2 (Pillow) en public/icons.

Uso: python scripts/make_icons.py
"""

import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Instala Pillow: pip install pillow")
    sys.exit(1)

ICONS_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(ICONS_DIR, exist_ok=True)

BG = (15, 15, 16, 255)  # negro #0f0f10 (token --accent, estilo Trade Republic)
FG = (255, 255, 255, 255)

FONT_CANDIDATES = [
    "C:/Windows/Fonts/arialbd.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def get_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def make_icon(size, radius_ratio=0.22, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if maskable:
        # Zona segura: fondo a sangre, glifo más pequeño.
        draw.rectangle([0, 0, size, size], fill=BG)
        glyph_ratio = 0.44
    else:
        r = int(size * radius_ratio)
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG)
        glyph_ratio = 0.58
    font = get_font(int(size * glyph_ratio))
    bbox = draw.textbbox((0, 0), "K", font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - w) // 2 - bbox[0]
    y = (size - h) // 2 - bbox[1] - int(size * 0.02)
    draw.text((x, y), "K", font=font, fill=FG)
    return img


SIZES = [
    ("icon-192.png", 192, False),
    ("icon-512.png", 512, False),
    ("maskable-512.png", 512, True),
    ("apple-touch-180.png", 180, False),
    ("favicon-32.png", 32, False),
]

print("Generando iconos de Kastos v2...")
for name, sz, maskable in SIZES:
    make_icon(sz, maskable=maskable).save(os.path.join(ICONS_DIR, name), "PNG")
    print(f"  OK {name} ({sz}x{sz})")

print("Listo: public/icons")
