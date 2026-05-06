"""Generate a placeholder icon.png (1024x1024) for the macOS bundle.

The build script (build-app.sh) converts this PNG into icon.icns via
sips + iconutil at build time. Pillow is required.
"""
import sys
from pathlib import Path


def main() -> int:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        sys.stderr.write("Pillow not installed; skipping icon generation\n")
        return 0

    out = Path(__file__).resolve().parent / "icon.png"
    size = 1024
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((32, 32, size - 32, size - 32), radius=180, fill=(108, 99, 255, 255), outline=(255, 255, 255, 64), width=12)

    text = "CO"
    font = None
    for candidate in [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]:
        if Path(candidate).is_file():
            try:
                font = ImageFont.truetype(candidate, 540)
                break
            except Exception:
                continue
    if font is None:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) // 2 - bbox[0]
    y = (size - th) // 2 - bbox[1]
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)

    img.save(out, "PNG")
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
