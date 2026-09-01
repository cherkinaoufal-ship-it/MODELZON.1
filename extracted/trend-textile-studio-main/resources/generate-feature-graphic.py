from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, sys
sys.path.insert(0, "/home/claude/project/resources")
OUT = "/home/claude/project/resources"

BG = (10, 10, 16, 255)
BG2 = (20, 22, 36, 255)
CYAN = (34, 211, 238, 255)
MAGENTA = (217, 70, 239, 255)
WHITE = (250, 253, 255, 255)

W, H = 1024, 500

def font(size, bold=True):
    path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    return ImageFont.truetype(path, size)

img = Image.new("RGBA", (W, H), BG)
px = img.load()
import math
for y in range(H):
    for x in range(W):
        d = min(1, math.hypot(x - W*0.28, y - H*0.5) / (W*0.55))
        r = int(BG2[0] + (BG[0]-BG2[0]) * d)
        g = int(BG2[1] + (BG[1]-BG2[1]) * d)
        b = int(BG2[2] + (BG[2]-BG2[2]) * d)
        px[x, y] = (r, g, b, 255)

d = ImageDraw.Draw(img)

# Monogram glyph (reuse the same M mark)
def draw_monogram(size):
    layer = Image.new("RGBA", (size, size), (0,0,0,0))
    dl = ImageDraw.Draw(layer)
    f = font(int(size * 0.62))
    text = "M"
    bbox = dl.textbbox((0,0), text, font=f)
    tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    tx = (size-tw)/2 - bbox[0]
    ty = (size-th)/2 - bbox[1] - size*0.06
    dl.text((tx, ty), text, font=f, fill=CYAN)
    lw = max(3, int(size*0.032))
    y0 = ty + th + size*0.10
    dl.line([(size*0.30,y0),(size*0.5,y0+size*0.07),(size*0.70,y0)], fill=CYAN, width=lw, joint="curve")
    return layer

glyph_size = 220
glyph = draw_monogram(glyph_size)
glow = glyph.filter(ImageFilter.GaussianBlur(10))
ga = glow.split()[3].point(lambda a: min(255, int(a*1.7)))
glow_c = Image.new("RGBA", (glyph_size, glyph_size), (*CYAN[:3], 0))
glow_c.putalpha(ga)
gx, gy = 70, (H-glyph_size)//2
img.alpha_composite(glow_c, (gx, gy))
img.alpha_composite(glyph, (gx, gy))

# Wordmark + tagline
tx = gx + glyph_size + 40
f1 = font(70)
f2 = font(26, bold=False)
d.text((tx, H*0.32), "MODELZON", font=f1, fill=WHITE)
d.text((tx, H*0.32 + 78), "Design. Compete. Wear it.", font=f2, fill=(148,163,184,255))

# Right-side accent: a soft glowing garment silhouette hint via simple shapes
import random
random.seed(3)
for i in range(3):
    cx = W - 160 + i*10
    cy = H*0.5 + (i-1)*90
    r = 46 - i*8
    ring = Image.new("RGBA", (W, H), (0,0,0,0))
    rd = ImageDraw.Draw(ring)
    rd.ellipse([cx-r, cy-r, cx+r, cy+r], outline=(CYAN if i % 2 == 0 else MAGENTA), width=3)
    ring = ring.filter(ImageFilter.GaussianBlur(1))
    img.alpha_composite(ring)

img.convert("RGB").save(os.path.join(OUT, "play-feature-graphic.png"), quality=95)
print("wrote play-feature-graphic.png", img.size)
