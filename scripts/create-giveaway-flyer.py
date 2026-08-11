from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
BACKGROUND = ROOT / "public" / "marketing" / "free-party-giveaway-background.png"
VENUE = ROOT / "public" / "marketing" / "jumping-jax-facility-empty-v2.png"
LOGO = ROOT / "public" / "logo.png"
OUTPUT = ROOT / "public" / "marketing" / "free-party-giveaway-flyer-v3.png"
TARGET_URL = "https://jumpingjaxllc.com/nominate"

WIDTH, HEIGHT = 1700, 2200
NAVY = "#10203f"
ORANGE = "#f97316"
PINK = "#ec4899"
TEAL = "#13b8bf"
WHITE = "#ffffff"
MUTED = "#475569"


def font(name: str, size: int):
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def fit_font(draw, text, max_width, start_size, font_name="arialbd.ttf"):
    size = start_size
    while size > 28:
        candidate = font(font_name, size)
        box = draw.textbbox((0, 0), text, font=candidate)
        if box[2] - box[0] <= max_width:
            return candidate
        size -= 2
    return font(font_name, size)


canvas = Image.open(BACKGROUND).convert("RGB").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
draw = ImageDraw.Draw(canvas)

# Use the real Jumping Jax venue as the flyer hero while retaining the colorful
# generated frame around the copy panels.
venue = Image.open(VENUE).convert("RGB")
venue_band = ImageOps.fit(
    venue,
    (WIDTH, 930),
    method=Image.Resampling.LANCZOS,
    centering=(0.5, 0.52),
)
canvas.paste(venue_band, (0, 600))
draw = ImageDraw.Draw(canvas)
draw.rectangle((0, 596, WIDTH, 607), fill=TEAL)
draw.rectangle((0, 607, WIDTH, 619), fill=NAVY)
draw.rectangle((0, 1518, WIDTH, 1530), fill=NAVY)
draw.rectangle((0, 1530, WIDTH, 1541), fill=TEAL)

# Preserve crisp white copy fields over the generated artwork.
draw.rounded_rectangle((55, 35, WIDTH - 55, 600), radius=56, fill=(255, 255, 255, 242), outline=TEAL, width=7)
draw.rounded_rectangle((55, 1530, WIDTH - 55, HEIGHT - 45), radius=56, fill=(255, 255, 255, 246), outline=NAVY, width=7)

logo = Image.open(LOGO).convert("RGBA")
logo.thumbnail((450, 220), Image.Resampling.LANCZOS)
canvas.paste(logo, ((WIDTH - logo.width) // 2, 25), logo)

headline_1 = "NOMINATE A CHILD"
headline_2 = "TO WIN A FREE PARTY!"
headline_font_1 = fit_font(draw, headline_1, 1480, 100)
headline_font_2 = fit_font(draw, headline_2, 1480, 112)
for text, y, face, color in [
    (headline_1, 245, headline_font_1, NAVY),
    (headline_2, 345, headline_font_2, PINK),
]:
    box = draw.textbbox((0, 0), text, font=face)
    draw.text(((WIDTH - (box[2] - box[0])) / 2, y), text, font=face, fill=color)

badge = "ONE WINNER  •  UP TO 20 CHILDREN"
badge_font = fit_font(draw, badge, 1200, 48)
badge_box = draw.textbbox((0, 0), badge, font=badge_font)
badge_width = badge_box[2] - badge_box[0] + 80
badge_x = (WIDTH - badge_width) // 2
draw.rounded_rectangle((badge_x, 485, badge_x + badge_width, 552), radius=34, fill="#fde047")
draw.text((badge_x + 40, 493), badge, font=badge_font, fill=NAVY)

qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=12, border=4)
qr.add_data(TARGET_URL)
qr.make(fit=True)
qr_image = qr.make_image(fill_color=NAVY, back_color=WHITE).convert("RGB").resize((390, 390), Image.Resampling.NEAREST)
canvas.paste(qr_image, (95, 1660))

draw.rounded_rectangle((90, 1570, 490, 1645), radius=36, fill=ORANGE)
scan_text = "SCAN TO NOMINATE"
scan_font = fit_font(draw, scan_text, 350, 42)
scan_box = draw.textbbox((0, 0), scan_text, font=scan_font)
draw.text((290 - (scan_box[2] - scan_box[0]) / 2, 1584), scan_text, font=scan_font, fill=WHITE)

copy_x = 535
copy_width = WIDTH - copy_x - 90
title_font = fit_font(draw, "CHOOSE YOUR CELEBRATION", copy_width, 52)
body_font = font("arialbd.ttf", 38)
small_font = font("arial.ttf", 31)

draw.text((copy_x, 1575), "CHOOSE YOUR CELEBRATION", font=title_font, fill=NAVY)
draw.text((copy_x, 1644), "September birthday OR back-to-school party", font=body_font, fill=PINK)
draw.text((copy_x, 1704), "Public or private party", font=body_font, fill=NAVY)
draw.text((copy_x, 1758), "Winner chooses the date — subject to availability", font=small_font, fill=MUTED)

draw.rounded_rectangle((copy_x, 1820, WIDTH - 90, 2020), radius=28, fill="#ecfeff", outline=TEAL, width=4)
draw.text((copy_x + 28, 1843), "PARTY INCLUDES", font=font("arialbd.ttf", 37), fill=TEAL)
included_lines = [
    "Drinks  •  Balloons  •  Plates & cutlery",
    "Themed tablecloths  •  Up to 20 children",
]
for index, line in enumerate(included_lines):
    draw.text((copy_x + 28, 1900 + index * 48), line, font=font("arialbd.ttf", 30), fill=NAVY)

deadline = "ENTRIES CLOSE AUGUST 30, 2026  •  DRAWING AUGUST 31"
deadline_font = fit_font(draw, deadline, 1510, 41)
deadline_box = draw.textbbox((0, 0), deadline, font=deadline_font)
draw.text(((WIDTH - (deadline_box[2] - deadline_box[0])) / 2, 2055), deadline, font=deadline_font, fill=ORANGE)

footer = "Jumping Jax • 559 Beaudrot Rd, Greenwood, SC • Parent/guardian approval required • No purchase necessary"
footer_font = fit_font(draw, footer, 1510, 24, "arial.ttf")
footer_box = draw.textbbox((0, 0), footer, font=footer_font)
draw.text(((WIDTH - (footer_box[2] - footer_box[0])) / 2, 2112), footer, font=footer_font, fill=MUTED)

canvas.save(OUTPUT, quality=95, dpi=(300, 300))
print(OUTPUT)
