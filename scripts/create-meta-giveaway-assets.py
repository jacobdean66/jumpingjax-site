from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "marketing" / "free-party-giveaway-flyer-v3.png"
OUT = ROOT / "public" / "marketing" / "meta"
OUT.mkdir(parents=True, exist_ok=True)


def font(name: str, size: int):
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


source = Image.open(SOURCE).convert("RGB")

# 4:5 feed placement. Contain the entire flyer so the logo, deadline, and
# footer remain visible; use narrow brand-color side rails instead of cropping.
feed = Image.new("RGB", (1080, 1350), "#10203f")
feed_art = ImageOps.contain(source, (1080, 1350), method=Image.Resampling.LANCZOS)
feed.paste(feed_art, ((1080 - feed_art.width) // 2, (1350 - feed_art.height) // 2))
feed.save(OUT / "giveaway-feed-1080x1350.png", quality=95)

# 9:16 Stories and Reels placement, preserving the full flyer rather than
# cropping away the QR code, deadline, or prize details.
story = Image.new("RGB", (1080, 1920), "#10203f")
draw = ImageDraw.Draw(story)
title = "NOMINATE BY AUGUST 30"
title_font = font("arialbd.ttf", 58)
title_box = draw.textbbox((0, 0), title, font=title_font)
draw.text(((1080 - (title_box[2] - title_box[0])) / 2, 62), title, font=title_font, fill="#ffffff")

scaled = source.resize((1000, 1294), Image.Resampling.LANCZOS)
story.paste(scaled, (40, 190))

draw.rounded_rectangle((145, 1550, 935, 1680), radius=65, fill="#f97316")
cta = "TAP TO NOMINATE"
cta_font = font("arialbd.ttf", 62)
cta_box = draw.textbbox((0, 0), cta, font=cta_font)
draw.text(((1080 - (cta_box[2] - cta_box[0])) / 2, 1577), cta, font=cta_font, fill="#ffffff")

details = [
    "One winner • Up to 20 children",
    "Greenwood, SC • Subject to availability",
    "Parent/guardian approval required • No purchase necessary",
]
for index, line in enumerate(details):
    detail_font = font("arialbd.ttf" if index == 0 else "arial.ttf", 33 if index == 0 else 27)
    box = draw.textbbox((0, 0), line, font=detail_font)
    draw.text(((1080 - (box[2] - box[0])) / 2, 1730 + index * 48), line, font=detail_font, fill="#ffffff")

story.save(OUT / "giveaway-story-1080x1920.png", quality=95)
print(OUT)
