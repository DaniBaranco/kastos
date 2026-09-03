#!/usr/bin/env python3
"""
make_icons.py — Genera los iconos PNG de Kastos con Pillow.
Requiere: pip install pillow

Uso:
    python make_icons.py
"""

import os, sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Instala Pillow: pip install pillow")
    sys.exit(1)

ICONS_DIR = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(ICONS_DIR, exist_ok=True)

BG = (48, 209, 88, 255)  # verde iOS #30d158
FG = (4, 41, 15, 255)    # verde muy oscuro #04290f

# Fuentes candidatas (Windows / macOS / Linux)
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

def make_icon(size, radius_ratio=0.22):
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    r    = int(size * radius_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG)
    font_size = int(size * 0.58)
    font = get_font(font_size)
    bbox = draw.textbbox((0, 0), "K", font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - w) // 2 - bbox[0]
    y = (size - h) // 2 - bbox[1] - int(size * 0.02)
    draw.text((x, y), "K", font=font, fill=FG)
    return img

SIZES = [
    ("icon-192.png",        192),
    ("icon-512.png",        512),
    ("maskable-512.png",    512),
    ("apple-touch-180.png", 180),
    ("favicon-32.png",       32),
]

print("Generando iconos de Kastos…")
for name, sz in SIZES:
    img = make_icon(sz)
    img.save(os.path.join(ICONS_DIR, name), "PNG")
    print(f"  ✓ {name}  ({sz}×{sz})")

print("\n¡Listo! Iconos guardados en /icons")
