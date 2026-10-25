#!/usr/bin/env python3
"""Generator HDRI langit Jakarta (equirectangular, Radiance .hdr).

Menghasilkan gradasi langit yang wajar secara fotometrik (radiance ~0.02..8),
bukan placeholder rusak. Dipakai game sebagai environment PBR (lihat MaterialSetup.loadEnv).

    python3 tools/make_sky.py app/src/main/assets/assets/env/sky.hdr
    python3 tools/make_sky.py out.hdr --sun-elev 25 --sun-azim 126
"""
import argparse
import math

W, H = 512, 256
ZENITH = (0.10, 0.19, 0.42)
HORIZON = (0.72, 0.66, 0.55)
GROUND = (0.055, 0.052, 0.045)
SUN = (1.00, 0.93, 0.80)


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def sky_pixel(az, el, sun_az, sun_el):
    """az: 0..2pi, el: -pi/2..pi/2 -> (r, g, b) linear radiance."""
    if el >= 0:
        # langit: horizon terang (haze) -> zenith biru
        t = smoothstep(0.0, 1.15, el)
        r = HORIZON[0] * (1 - t) + ZENITH[0] * t
        g = HORIZON[1] * (1 - t) + ZENITH[1] * t
        b = HORIZON[2] * (1 - t) + ZENITH[2] * t
        # glow hangat di dekat horizon
        glow = math.exp(-el * 9.0) * 0.35
        r += glow * 0.9
        g += glow * 0.62
        b += glow * 0.28
        # matahari: disk tajam + halo
        d = math.acos(
            max(-1.0, min(1.0,
                math.sin(el) * math.sin(sun_el) +
                math.cos(el) * math.cos(sun_el) * math.cos(az - sun_az)))
        )
        disk = 60.0 * math.exp(-(d / 0.012) ** 2)
        halo = 1.6 * math.exp(-(d / 0.16) ** 2) + 0.25 * math.exp(-(d / 0.7) ** 2)
        r += (disk + halo) * SUN[0]
        g += (disk + halo) * SUN[1]
        b += (disk + halo * 0.85) * SUN[2]
        # awan tipis: pola lembut deterministik
        cl = 0.5 + 0.5 * math.sin(az * 3.0 + 1.7) * math.sin(el * 7.0 + 0.4)
        cl = smoothstep(0.55, 1.0, cl) * smoothstep(0.02, 0.45, el) * 0.35
        r += cl * 0.55
        g += cl * 0.58
        b += cl * 0.62
        return (r, g, b)
    # tanah/bidang bawah: gelap, sedikit hangat
    t = smoothstep(0.0, 0.6, -el)
    return (
        GROUND[0] * (1.0 - 0.35 * t),
        GROUND[1] * (1.0 - 0.35 * t),
        GROUND[2] * (1.0 - 0.30 * t),
    )


def to_rgbe(rgb):
    m = max(rgb)
    if m < 1e-32:
        return (0, 0, 0, 0)
    mant, exp = math.frexp(m)          # m = mant * 2**exp, 0.5 <= mant < 1
    scale = mant * 256.0 / m
    return (
        min(255, int(rgb[0] * scale)),
        min(255, int(rgb[1] * scale)),
        min(255, int(rgb[2] * scale)),
        exp + 128,
    )


def rle_channel(values):
    """RLE Radiance: [count>128][value] untuk run, [count<=128][literal...]."""
    out = bytearray()
    i, n = 0, len(values)
    while i < n:
        run = 1
        while i + run < n and values[i + run] == values[i] and run < 127:
            run += 1
        if run >= 4:
            out.append(128 + run)
            out.append(values[i])
            i += run
        else:
            start = i
            while i < n and i - start < 128:
                if (i + 3 < n and values[i] == values[i + 1] == values[i + 2] == values[i + 3]):
                    break
                i += 1
            lit = values[start:i]
            out.append(len(lit))
            out.extend(lit)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--sun-elev', type=float, default=28.0)
    ap.add_argument('--sun-azim', type=float, default=126.0)
    ap.add_argument('--width', type=int, default=W)
    ap.add_argument('--height', type=int, default=H)
    a = ap.parse_args()

    w, h = a.width, a.height
    sun_el = math.radians(a.sun_elev)
    sun_az = math.radians(a.sun_azim)

    body = bytearray()
    for y in range(h):
        el = (0.5 - (y + 0.5) / h) * math.pi       # +90 derajat atas
        chans = (bytearray(), bytearray(), bytearray(), bytearray())
        for x in range(w):
            az = (x + 0.5) / w * 2 * math.pi
            rgb = sky_pixel(az, el, sun_az, sun_el)
            e = to_rgbe(rgb)
            for c in range(4):
                chans[c].append(e[c])
        if w < 8 or w > 32767:
            # scanline lama (flat)
            for x in range(w):
                body.extend((chans[0][x], chans[1][x], chans[2][x], chans[3][x]))
        else:
            body.extend((2, 2, (w >> 8) & 0xFF, w & 0xFF))
            for c in range(4):
                body.extend(rle_channel(chans[c]))

    header = b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y %d +X %d\n' % (h, w)
    with open(a.out, 'wb') as f:
        f.write(header + body)
    print('tulis %s: %d byte (%dx%d)' % (a.out, len(header) + len(body), w, h))


if __name__ == '__main__':
    main()
