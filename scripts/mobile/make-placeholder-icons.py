"""
Placeholder PWA / iOS icons: terracotta tile with the hiragana "に".

These are stand-ins until the real icon arrives (see docs/mobile/README.md).
Re-run after swapping the glyph or colours:

    python3 scripts/mobile/make-placeholder-icons.py

Needs Pillow and a CJK font (Noto Sans CJK). Writes into public/icons/.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BRAND = (180, 61, 32, 255)      # #b43d20, the terracotta used in Header/Footer/Home
WHITE = (255, 255, 255, 255)
OUT = Path(__file__).resolve().parents[2] / "public" / "icons"
FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"


def tile(size: int, *, maskable: bool, rounded: bool) -> Image.Image:
    """
    maskable: glyph sits inside the 80% safe zone so Android masks don't clip it.
    rounded:  draw our own corner radius (for the plain icon); Apple applies its
              own mask, so the apple-touch-icon is a plain square.
    """
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=size // 5, fill=BRAND)
    else:
        d.rectangle((0, 0, size - 1, size - 1), fill=BRAND)
    glyph_px = int(size * (0.50 if maskable else 0.62))
    font = ImageFont.truetype(FONT, glyph_px, index=0)
    text = "に"
    bbox = d.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), text, font=font, fill=WHITE)
    return im


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tile(192, maskable=False, rounded=True).save(OUT / "icon-192.png")
    tile(512, maskable=False, rounded=True).save(OUT / "icon-512.png")
    tile(512, maskable=True, rounded=False).save(OUT / "icon-512-maskable.png")
    # Apple ignores transparency and adds its own rounded mask: flat, opaque square.
    tile(180, maskable=False, rounded=False).convert("RGB").save(OUT / "apple-touch-icon.png")
    print("wrote", sorted(p.name for p in OUT.iterdir()))


if __name__ == "__main__":
    main()
