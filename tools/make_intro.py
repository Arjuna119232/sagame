#!/usr/bin/env python3
"""Render the SAGame splash intro and encode it with ffmpeg.

Visual language follows the game's loading screen (skyline() in index.html):
Jakarta sunset gradient, dark skyline with a few lit windows, Monas obelisk
with its gold flame, bold condensed type.

Usage: python3 tools/make_intro.py app/src/main/assets/intro.mp4
"""
import math
import subprocess
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

W, H = 1280, 720
FPS = 30
DUR = 6.4
N = int(DUR * FPS)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_COND = "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"

SKY = [(0x1B, 0x10, 0x38), (0x2B, 0x1B, 0x4A), (0xE8, 0x69, 0x3A), (0xFF, 0xB3, 0x5A)]
SILHOUETTE = (0x12, 0x0C, 0x1C)
HORIZON = 0.62


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sky_color(p):
    stops = [(0.0, SKY[0]), (0.45, SKY[1]), (0.78, SKY[2]), (1.0, SKY[3])]
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        if p0 <= p <= p1:
            return lerp(c0, c1, (p - p0) / (p1 - p0))
    return stops[-1][1]


def clamp01(x):
    return 0.0 if x < 0 else (1.0 if x > 1 else x)


def smooth(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def fade(t, start, end, fade_in=0.5, fade_out=0.5):
    if t < start or t > end:
        return 0.0
    return smooth((t - start) / fade_in) * smooth((end - t) / fade_out)


def build_background(scale=1.0):
    """Sunset skyline. Rendered slightly oversized so we can slow-zoom later."""
    w, h = int(W * scale), int(H * scale)
    horizon = h * HORIZON
    bg = Image.new("RGB", (w, h), SKY[0])
    d = ImageDraw.Draw(bg)

    for y in range(int(horizon) + 1):
        d.line([(0, y), (w, y)], fill=sky_color(y / horizon))
    d.rectangle([0, horizon, w, h], fill=SILHOUETTE)

    # sun glow behind the skyline (screen blend so the sky stays bright)
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = w * 0.5, horizon
    for r in range(int(340 * scale), 0, -4):
        a = (1 - r / (340 * scale)) ** 2
        gd.ellipse([cx - r * 1.7, cy - r, cx + r * 1.7, cy + r],
                   fill=lerp((0, 0, 0), (0xFF, 0xC0, 0x40), a * 0.75))
    glow = glow.filter(ImageFilter.GaussianBlur(10))
    glow.paste((0, 0, 0), (0, int(horizon), w, h))  # keep ground dark
    bg = ImageChops.screen(bg, glow)

    # skyline blocks with sparse lit windows
    d = ImageDraw.Draw(bg)
    seed = 7
    x = -30
    while x < w + 40:
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        bw = int((28 + (seed >> 8) % 60) * scale)
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        bh = int((70 + (seed >> 4) % 190) * scale)
        top = horizon - bh
        d.rectangle([x, top, x + bw, h], fill=SILHOUETTE)
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        if (seed >> 3) % 3 == 0:
            for wy in range(int(top) + 16, int(horizon) - 12, int(22 * scale)):
                for wx in range(int(x) + 9, int(x + bw) - 9, int(17 * scale)):
                    seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
                    if (seed >> 5) % 4 == 0:
                        d.rectangle([wx, wy, wx + int(6 * scale), wy + int(9 * scale)],
                                    fill=(0xFF, 0xD9, 0x8A) if (seed >> 7) % 3 else (0x5A, 0x7A, 0xA5))
        x += bw + int((12 + (seed >> 11) % 16) * scale)

    # Monas obelisk with gold flame
    mx = w * 0.775
    s2 = scale * 0.82
    d.rectangle([mx - 30 * s2, horizon - 22 * s2, mx + 30 * s2, horizon + 6 * s2],
                fill=(0xE8, 0xE8, 0xE8))
    d.polygon([(mx - 11 * s2, horizon - 22 * s2), (mx + 11 * s2, horizon - 22 * s2),
               (mx + 6 * s2, horizon - 178 * s2), (mx - 6 * s2, horizon - 178 * s2)],
              fill=(0xF0, 0xF0, 0xF0))
    d.rectangle([mx - 17 * s2, horizon - 182 * s2, mx + 17 * s2, horizon - 172 * s2],
                fill=(0xE8, 0xE8, 0xE8))
    d.polygon([(mx, horizon - 206 * s2), (mx + 8 * s2, horizon - 178 * s2),
               (mx - 8 * s2, horizon - 178 * s2)], fill=(0xFF, 0xC8, 0x30))
    return bg


def fit_font(text, font_path, max_width, tracking="\u2009", start=160, floor=24):
    """Largest font size whose rendered (letter-spaced) text fits max_width."""
    probe = Image.new("RGBA", (10, 10))
    pd = ImageDraw.Draw(probe)
    spaced = tracking.join(text) if tracking else text
    size = start
    while size > floor:
        f = ImageFont.truetype(font_path, size)
        if pd.textbbox((0, 0), spaced, font=f)[2] <= max_width:
            return f
        size -= 2
    return ImageFont.truetype(font_path, floor)


def text_layer(text, font, y_center, fill, tracking="\u2009", glow=0):
    """Transparent RGBA layer with centered, letter-spaced text."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if tracking:
        text = tracking.join(text)
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pos = ((W - tw) / 2 - bbox[0], y_center - th / 2 - bbox[1])
    if glow:
        halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(halo).text(pos, text, font=font, fill=fill + (110,))
        halo = halo.filter(ImageFilter.GaussianBlur(glow))
        layer = Image.alpha_composite(layer, halo)
    ImageDraw.Draw(layer).text(pos, text, font=font, fill=fill + (255,))
    return layer


def compose(base, layer, alpha):
    if alpha <= 0:
        return base
    if alpha < 1:
        r, g, b, a = layer.split()
        a = a.point(lambda v: int(v * alpha))
        layer = Image.merge("RGBA", (r, g, b, a))
    return Image.alpha_composite(base.convert("RGBA"), layer)


def main(out_path):
    zoom_from, zoom_to = 1.0, 1.05
    bg_frames = {
        "near": build_background(1.0),
        "far": build_background(zoom_to),
    }

    f_name = fit_font("0xmahen", FONT_BOLD, W * 0.62, tracking="\u2009")
    f_pres = fit_font("PRESENTS", FONT_COND, W * 0.24, tracking="\u200a")
    f_title1 = fit_font("PREMAN", FONT_COND, W * 0.56, tracking="\u2009")
    f_title2 = fit_font("GANG SEMPIT", FONT_COND, W * 0.72, tracking="\u2009")
    f_by = fit_font("by 0xmahen", FONT_COND, W * 0.18, tracking="\u200a")

    name_l = text_layer("0xmahen", f_name, H * 0.42, (0xFF, 0xFF, 0xFF), glow=10)
    pres_l = text_layer("PRESENTS", f_pres, H * 0.545, (0xF0, 0xF0, 0xF0), tracking="\u200a")
    t1_l = text_layer("PREMAN", f_title1, H * 0.385, (0xFF, 0xFF, 0xFF), glow=12)
    t2_l = text_layer("GANG SEMPIT", f_title2, H * 0.545, (0xFF, 0xB1, 0x2A), glow=12)
    by_l = text_layer("by 0xmahen", f_by, H * 0.705, (0xDD, 0xDD, 0xDD), tracking="\u200a")

    scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scrim)
    for r in range(430, 0, -6):
        a = int(120 * (1 - r / 430) ** 1.6)
        sd.ellipse([W / 2 - r * 1.5, H * 0.47 - r * 0.62, W / 2 + r * 1.5, H * 0.47 + r * 0.62],
                   fill=(4, 4, 10, a))
    scrim = scrim.filter(ImageFilter.GaussianBlur(24))

    ff = subprocess.Popen(
        [
            "/usr/bin/ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
            "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
            "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            out_path,
        ],
        stdin=subprocess.PIPE,
    )

    for i in range(N):
        t = i / FPS
        p = smooth(t / DUR)
        far = bg_frames["far"].resize((W, H), Image.BILINEAR)
        bg = Image.blend(bg_frames["near"].resize((W, H), Image.BILINEAR), far, p)

        frame = bg
        scrim_alpha = fade(t, 2.20, 6.45, 0.7, 0.8)
        if scrim_alpha > 0:
            frame = compose(frame, scrim, scrim_alpha * 0.85)
        frame = compose(frame, name_l, fade(t, 0.15, 2.35, 0.55, 0.5))
        frame = compose(frame, pres_l, fade(t, 0.75, 2.35, 0.45, 0.5))
        frame = compose(frame, t1_l, fade(t, 2.30, 6.45, 0.6, 0.75))
        frame = compose(frame, t2_l, fade(t, 2.55, 6.45, 0.6, 0.75))
        frame = compose(frame, by_l, fade(t, 3.35, 6.45, 0.55, 0.75))

        frame = frame.convert("RGB")
        if t > 5.65:  # fade to black so the hand-off to the loader is seamless
            frame = Image.blend(frame, Image.new("RGB", (W, H), (0, 0, 0)),
                                smooth((t - 5.65) / 0.75) * 0.92)

        ff.stdin.write(frame.tobytes())

    ff.stdin.close()
    rc = ff.wait()
    if rc != 0:
        raise SystemExit(f"ffmpeg failed with {rc}")


if __name__ == "__main__":
    main(sys.argv[1])
