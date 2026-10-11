#!/usr/bin/env python3
"""Share images (Open Graph, 1200 x 630) for usegeo.app: the home page, the tools hub and each free tool.

Run from the repo root:  python3 scripts/tools-og.py
Needs Python 3 and Pillow (dev time only, not part of the Docker build). Writes public/og/*.png; commit them.

Each tool image is a clean drawing of that tool's result on a white card over a soft lilac-to-white
background. At most the tool's name as text, no logo (Google advises against logos and text-heavy images
for thumbnails). Everything is drawn, nothing is a real result, so no numbers or names appear.
Each file must stay under 200 KB (checked at the end).
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "public", "og")
W, H = 1200, 630
MAX_BYTES = 200_000

# Colours from app/styles/check.css and design/overview/base.css
NAVY = (11, 12, 43)
NAVY_3 = (55, 56, 104)
TEXT = (92, 93, 120)
LILAC_50 = (239, 236, 253)
LILAC_100 = (226, 226, 252)
PERI_300 = (191, 201, 250)
LILAC_DEEP = (181, 168, 224)
COBALT = (64, 80, 176)
COBALT_MID = (104, 120, 216)
GREEN = (60, 194, 106)
GREEN_BG = (233, 249, 238)
AMBER = (240, 177, 80)
AMBER_BG = (253, 243, 226)
RED = (239, 90, 90)
GREY = (214, 213, 222)
GREY_SOFT = (236, 236, 241)
LINE_SOFT = (230, 229, 224)
WARM_50 = (248, 247, 244)
WHITE = (255, 255, 255)
E_CHATGPT = (16, 163, 127)
E_GEMINI = (79, 124, 255)
E_PERPLEXITY = (32, 128, 141)

FONT_FILES = [
    os.path.join(ROOT, "app", "assets", "fonts", "Geist-SemiBold.ttf"),
    "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def font(size: int) -> ImageFont.FreeTypeFont:
    for f in FONT_FILES:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def background() -> Image.Image:
    """Soft lilac at the top fading to white, with the faint cobalt grid of the site's bands."""
    img = Image.new("RGB", (W, H), WHITE)
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        # lilac-50 -> lilac-100 -> white
        if t < 0.45:
            k = t / 0.45
            c = tuple(round(LILAC_50[i] + (LILAC_100[i] - LILAC_50[i]) * k) for i in range(3))
        else:
            k = (t - 0.45) / 0.55
            c = tuple(round(LILAC_100[i] + (WHITE[i] - LILAC_100[i]) * k) for i in range(3))
        for x in range(W):
            px[x, y] = c
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(grid)
    for x in range(0, W, 64):
        g.line([(x, 0), (x, H)], fill=(64, 80, 176, 16), width=1)
    for y in range(0, H, 64):
        g.line([(0, y), (W, y)], fill=(64, 80, 176, 16), width=1)
    img = img.convert("RGBA")
    img.alpha_composite(grid)
    return img


def card(img: Image.Image, box: tuple[int, int, int, int], radius: int = 36) -> None:
    """A white card with a thin warm line and a soft shadow."""
    x0, y0, x1, y1 = box
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x0, y0 + 22, x1, y1 + 22), radius, fill=(56, 64, 160, 60))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    img.alpha_composite(shadow)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius, fill=WHITE, outline=LINE_SOFT, width=2)


def bar(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int = 16, fill=GREY) -> None:
    d.rounded_rectangle((x, y, x + w, y + h), h // 2, fill=fill)


def dot(d: ImageDraw.ImageDraw, cx: int, cy: int, r: int, fill) -> None:
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill)


def tick(d: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color=WHITE, width: int = 5) -> None:
    d.line([(cx - r * 0.45, cy + r * 0.02), (cx - r * 0.1, cy + r * 0.35), (cx + r * 0.48, cy - r * 0.33)], fill=color, width=width, joint="curve")


def title(d: ImageDraw.ImageDraw, x: int, y: int, text: str, size: int = 44) -> None:
    d.text((x, y), text, font=font(size), fill=NAVY)


# ---------- one drawing per tool ----------

CARD = (120, 72, 1080, 572)
PAD_X = CARD[0] + 64
TOP = CARD[1] + 48  # the tool name
C = TOP + 106  # where the drawing starts, clear of the name


def draw_visibility(img: Image.Image, name: str) -> None:
    card(img, CARD)
    d = ImageDraw.Draw(img)
    title(d, PAD_X, TOP, name)
    # score ring
    cx, cy, r = 330, C + 150, 104
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=GREY_SOFT, width=26)
    d.arc((cx - r, cy - r, cx + r, cy + r), start=-90, end=150, fill=COBALT, width=26)
    dot(d, cx, cy, 38, LILAC_50)
    # one row per assistant: colour dot, a bar
    rows = [(E_CHATGPT, 300, True), (E_GEMINI, 220, False), (E_PERPLEXITY, 260, True)]
    for i, (col, w, named) in enumerate(rows):
        y = C + 62 + i * 72
        dot(d, 520, y + 12, 14, col)
        bar(d, 556, y + 4, w, 18, GREY_SOFT)
        if named:
            dot(d, 940, y + 12, 18, GREEN)
            tick(d, 940, y + 12, 18, width=4)
        else:
            dot(d, 940, y + 12, 18, GREY)


def draw_overview(img: Image.Image, name: str) -> None:
    card(img, CARD)
    d = ImageDraw.Draw(img)
    title(d, PAD_X, TOP, name)
    # the overview text block with a sparkle
    sx, sy = PAD_X + 14, C + 8
    d.polygon([(sx, sy - 16), (sx + 5, sy - 5), (sx + 16, sy), (sx + 5, sy + 5), (sx, sy + 16), (sx - 5, sy + 5), (sx - 16, sy), (sx - 5, sy - 5)], fill=COBALT)
    for i, w in enumerate([560, 600, 420]):
        bar(d, PAD_X + 48, C + i * 34, w, 16, GREY_SOFT)
    # numbered sources
    f = font(24)
    for i in range(4):
        y = C + 116 + i * 46
        dot(d, PAD_X + 20, y + 14, 20, LILAC_100)
        n = str(i + 1)
        tw = d.textlength(n, font=f)
        d.text((PAD_X + 20 - tw / 2, y + 1), n, font=f, fill=COBALT)
        bar(d, PAD_X + 60, y + 6, [300, 360, 260, 330][i], 16, GREY)
        if i in (0, 2):
            bar(d, 860, y + 3, 90, 22, GREEN_BG)


def draw_crawler(img: Image.Image, name: str) -> None:
    card(img, CARD)
    d = ImageDraw.Draw(img)
    title(d, PAD_X, TOP, name)
    rows = [True, True, False, True, False]
    for i, ok in enumerate(rows):
        y = C + i * 58
        d.rounded_rectangle((PAD_X, y, PAD_X + 40, y + 40), 10, fill=LILAC_50)
        bar(d, PAD_X + 64, y + 12, [260, 220, 300, 180, 240][i], 16, GREY_SOFT)
        dot(d, 920, y + 20, 18, GREEN if ok else GREY)
        if ok:
            tick(d, 920, y + 20, 18, width=4)
        else:
            d.line([(912, y + 20), (928, y + 20)], fill=WHITE, width=4)


def draw_schema(img: Image.Image, name: str) -> None:
    card(img, CARD)
    d = ImageDraw.Draw(img)
    title(d, PAD_X, TOP, name)
    found = [True, True, True, False, True, False]
    for i, ok in enumerate(found):
        col, row = i % 2, i // 2
        x = PAD_X + col * 420
        y = C + row * 92
        if ok:
            dot(d, x + 20, y + 20, 20, GREEN)
            tick(d, x + 20, y + 20, 20, width=5)
        else:
            d.ellipse((x, y, x + 40, y + 40), outline=GREY, width=4)
        bar(d, x + 60, y + 4, [150, 120, 170, 140, 110, 160][i], 16, NAVY_3 if ok else GREY)
        bar(d, x + 60, y + 30, [230, 260, 200, 240, 250, 210][i], 12, GREY_SOFT)


def code_lines(d: ImageDraw.ImageDraw, x: int, y: int, lines: list[list[tuple[int, tuple[int, int, int]]]], step: int = 40) -> None:
    for i, segs in enumerate(lines):
        cx = x
        for w, col in segs:
            if w > 0:
                bar(d, cx, y + i * step, w, 14, col)
            cx += abs(w) + 12


def draw_llms(img: Image.Image, name: str) -> None:
    card(img, CARD)
    d = ImageDraw.Draw(img)
    title(d, PAD_X, TOP, name)
    d.rounded_rectangle((PAD_X, C - 20, CARD[2] - 64, CARD[3] - 44), 20, fill=WARM_50)
    lines = [
        [(26, COBALT), (160, NAVY_3)],
        [],
        [(18, LILAC_DEEP), (420, GREY)],
        [],
        [(26, COBALT), (200, NAVY_3)],
        [(14, LILAC_DEEP), (180, COBALT_MID), (260, GREY)],
        [(14, LILAC_DEEP), (150, COBALT_MID), (300, GREY)],
    ]
    code_lines(d, PAD_X + 32, C + 8, lines, step=38)
    for i, ok in [(0, True), (2, True), (5, True), (6, False)]:
        y = C + 8 + i * 38 + 7
        dot(d, CARD[2] - 104, y, 14, GREEN if ok else AMBER)
        if ok:
            tick(d, CARD[2] - 104, y, 14, width=3)


def draw_faq(img: Image.Image, name: str) -> None:
    card(img, CARD)
    d = ImageDraw.Draw(img)
    title(d, PAD_X, TOP, name)
    # questions and answers on the left
    for i in range(3):
        y = C + i * 100
        bar(d, PAD_X, y, [250, 210, 270][i], 18, NAVY_3)
        bar(d, PAD_X, y + 34, [320, 300, 280][i], 13, GREY_SOFT)
        bar(d, PAD_X, y + 58, [220, 260, 180][i], 13, GREY_SOFT)
    # the generated code on the right
    x0 = 610
    d.rounded_rectangle((x0, C - 20, CARD[2] - 56, CARD[3] - 44), 20, fill=WARM_50)
    lines = [
        [(20, COBALT_MID)],
        [(-24, GREY), (110, COBALT), (90, GREEN)],
        [(-24, GREY), (130, COBALT), (20, COBALT_MID)],
        [(-48, GREY), (90, COBALT), (120, GREEN)],
        [(-48, GREY), (110, COBALT), (100, GREEN)],
        [(-24, GREY), (20, COBALT_MID)],
        [(20, COBALT_MID)],
    ]
    code_lines(d, x0 + 28, C + 6, lines, step=40)


def draw_bot(img: Image.Image, name: str) -> None:
    card(img, CARD)
    d = ImageDraw.Draw(img)
    title(d, PAD_X, TOP, name)
    # a product description; some phrases highlighted in amber (vague) and one fact in green
    lines = [
        [(180, GREY_SOFT), (190, AMBER_BG), (230, GREY_SOFT)],
        [(240, GREY_SOFT), (200, GREY_SOFT), (140, AMBER_BG)],
        [(120, GREEN_BG), (300, GREY_SOFT), (160, GREY_SOFT)],
        [(260, AMBER_BG), (220, GREY_SOFT)],
        [(200, GREY_SOFT), (240, GREY_SOFT), (130, GREY_SOFT)],
    ]
    for i, segs in enumerate(lines):
        x = PAD_X
        y = C + 8 + i * 58
        for w, col in segs:
            if col == AMBER_BG:
                d.rounded_rectangle((x - 6, y - 8, x + w + 6, y + 30), 10, fill=AMBER_BG)
                bar(d, x, y + 4, w, 14, (232, 196, 132))
            elif col == GREEN_BG:
                d.rounded_rectangle((x - 6, y - 8, x + w + 6, y + 30), 10, fill=GREEN_BG)
                bar(d, x, y + 4, w, 14, (140, 210, 165))
            else:
                bar(d, x, y + 4, w, 14, col)
            x += w + 18


def draw_hub(img: Image.Image, name: str) -> None:
    """The hub: seven small cards, each with a tiny sketch of its tool."""
    d = ImageDraw.Draw(img)
    title(d, 120, 72, name, size=52)
    cards = [(120 + c * 248, 170 + r * 206) for r in range(2) for c in range(4)][:7]
    for i, (x, y) in enumerate(cards):
        box = (x, y, x + 220, y + 180)
        card(img, box, radius=24)
        d = ImageDraw.Draw(img)
        cx, cy = x + 110, y + 90
        if i == 0:  # visibility ring
            d.ellipse((cx - 44, cy - 44, cx + 44, cy + 44), outline=GREY_SOFT, width=14)
            d.arc((cx - 44, cy - 44, cx + 44, cy + 44), start=-90, end=140, fill=COBALT, width=14)
        elif i == 1:  # overview sources
            for k in range(3):
                dot(d, x + 44, y + 52 + k * 38, 11, LILAC_100)
                bar(d, x + 66, y + 46 + k * 38, [110, 90, 120][k], 12, GREY)
        elif i == 2:  # crawler rows
            for k, ok in enumerate([True, False, True]):
                bar(d, x + 36, y + 48 + k * 38, 100, 12, GREY_SOFT)
                dot(d, x + 176, y + 54 + k * 38, 11, GREEN if ok else GREY)
        elif i == 3:  # schema ticks
            for k, ok in enumerate([True, True, False]):
                if ok:
                    dot(d, x + 46, y + 54 + k * 38, 12, GREEN)
                    tick(d, x + 46, y + 54 + k * 38, 12, width=3)
                else:
                    d.ellipse((x + 34, y + 42 + k * 38, x + 58, y + 66 + k * 38), outline=GREY, width=3)
                bar(d, x + 72, y + 48 + k * 38, [100, 80, 110][k], 12, GREY)
        elif i == 4:  # llms.txt lines
            for k, (w, col) in enumerate([(90, COBALT), (130, GREY), (70, COBALT_MID), (120, GREY)]):
                bar(d, x + 36, y + 44 + k * 30, w, 11, col)
        elif i == 5:  # faq code
            for k, (ind, w, col) in enumerate([(0, 14, COBALT_MID), (18, 90, COBALT), (18, 110, GREEN), (0, 14, COBALT_MID)]):
                bar(d, x + 40 + ind, y + 46 + k * 30, w, 11, col)
        else:  # bot checker highlights
            for k, segs in enumerate([[(60, False), (60, True)], [(90, False), (40, False)], [(50, True), (80, False)]]):
                xx = x + 34
                for w, hl in segs:
                    if hl:
                        d.rounded_rectangle((xx - 4, y + 42 + k * 38, xx + w + 4, y + 66 + k * 38), 8, fill=AMBER_BG)
                    bar(d, xx, y + 48 + k * 38, w, 12, (232, 196, 132) if hl else GREY_SOFT)
                    xx += w + 10


def home_image() -> Image.Image:
    """The clay shop front from the home page, whole (a centre crop would cut off its speech bubble):
    scaled to the image height, with the background's own colours carried out to the sides."""
    src = Image.open(os.path.join(ROOT, "design", "overview", "img", "clay-storefront.jpg")).convert("RGB")
    scale = H / src.height
    art = src.resize((round(src.width * scale), H), Image.LANCZOS)
    out = Image.new("RGB", (W, H))
    left = (W - art.width) // 2
    # each row's edge colour, carried out to each side (the background is a soft vertical gradient)
    lcol = art.crop((0, 0, 1, H)).resize((left, H))
    rcol = art.crop((art.width - 1, 0, art.width, H)).resize((W - left - art.width, H))
    out.paste(lcol, (0, 0))
    out.paste(rcol, (left + art.width, 0))
    out.paste(art, (left, 0))
    return out


TOOLS = [
    ("ai-visibility-checker", "AI Visibility Checker", draw_visibility),
    ("ai-overview-checker", "AI Overview Checker", draw_overview),
    ("ai-crawler-checker", "AI Crawler Checker", draw_crawler),
    ("product-schema-checker", "Product Schema Checker", draw_schema),
    ("llms-txt-checker", "llms.txt Checker", draw_llms),
    ("faq-schema-generator", "FAQ Schema Generator", draw_faq),
    ("ai-bot-checker", "AI Bot Checker", draw_bot),
]


def save(img: Image.Image, name: str, photo: bool = False) -> str:
    path = os.path.join(OUT, name)
    rgb = img.convert("RGB")
    if photo:
        # the clay render has soft gradients: an adaptive palette keeps it small with little banding
        rgb = rgb.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    else:
        rgb = rgb.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    rgb.save(path, "PNG", optimize=True)
    return path


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    written = [save(home_image(), "home.png", photo=True)]
    hub = background()
    draw_hub(hub, "Free tools")
    written.append(save(hub, "tools.png"))
    for slug, name, draw in TOOLS:
        img = background()
        draw(img, name)
        written.append(save(img, f"{slug}.png"))
    too_big = False
    for p in written:
        size = os.path.getsize(p)
        flag = "" if size < MAX_BYTES else "  TOO BIG"
        too_big = too_big or size >= MAX_BYTES
        print(f"{os.path.relpath(p, ROOT)}: {size / 1000:.0f} KB{flag}")
    return 1 if too_big else 0


if __name__ == "__main__":
    sys.exit(main())
