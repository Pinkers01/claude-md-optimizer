"""Generate a placeholder icon.ico (256x256 violet 'CO' monogram).

Used when no designer-supplied icon is checked in. Produces a multi-size
ICO file with 16, 32, 48, 64, 128, 256 pixel variants.
Requires Pillow.
"""
import sys
from pathlib import Path


def main() -> int:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        sys.stderr.write("Pillow not installed; skipping icon generation\n")
        return 0

    out = Path(__file__).resolve().parent / "icon.ico"
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

    base = Image.new("RGBA", (256, 256), (108, 99, 255, 255))
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((8, 8, 248, 248), radius=44, fill=(108, 99, 255, 255), outline=(255, 255, 255, 60), width=4)

    text = "CO"
    font = None
    for candidate in [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ]:
        if Path(candidate).is_file():
            try:
                font = ImageFont.truetype(candidate, 132)
                break
            except Exception:
                continue
    if font is None:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (256 - tw) // 2 - bbox[0]
    y = (256 - th) // 2 - bbox[1]
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)

    base.save(out, sizes=sizes)
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
