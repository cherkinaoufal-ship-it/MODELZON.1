from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, os

OUT = "/home/claude/project/resources"
os.makedirs(OUT, exist_ok=True)

BG = (10, 10, 16, 255)
BG2 = (18, 20, 32, 255)
CYAN = (34, 211, 238, 255)
WHITE = (250, 253, 255, 255)

def radial_bg(size, c1, c2):
    img = Image.new("RGBA", (size, size), c1)
    px = img.load()
    cx, cy = size / 2, size * 0.36
    maxd = math.hypot(size, size) * 0.62
    for y in range(size):
        for x in range(size):
            d = min(1, math.hypot(x - cx, y - cy) / maxd)
            r = int(c1[0] + (c2[0]-c1[0]) * (1-d))
            g = int(c1[1] + (c2[1]-c1[1]) * (1-d))
            b = int(c1[2] + (c2[2]-c1[2]) * (1-d))
            px[x, y] = (r, g, b, 255)
    return img

def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=255)
    return mask

def glow(layer, blur, boost=1.6):
    g = layer.filter(ImageFilter.GaussianBlur(blur))
    a = g.split()[3].point(lambda v: min(255, int(v * boost)))
    colored = Image.new("RGBA", layer.size, (*CYAN[:3], 0))
    colored.putalpha(a)
    return colored

def font(size):
    for path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def draw_monogram(size):
    """Bold glowing 'M' with a sharp downward chevron underline — reads as a
    clean brand monogram at any size, from a 48px launcher icon up to a
    2732px splash screen."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = font(int(size * 0.62))
    text = "M"
    bbox = d.textbbox((0, 0), text, font=f)
    tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    tx = (size - tw)/2 - bbox[0]
    ty = (size - th)/2 - bbox[1] - size*0.06
    d.text((tx, ty), text, font=f, fill=CYAN)

    # underline chevron (nods to a garment neckline / stitch)
    lw = max(3, int(size * 0.032))
    y0 = ty + th + size * 0.10
    d.line([(size*0.30, y0), (size*0.5, y0 + size*0.07), (size*0.70, y0)], fill=CYAN, width=lw, joint="curve")
    return layer

def make_icon(size, filename, rounded_corners=True):
    canvas = radial_bg(size, BG2, BG)
    glyph = draw_monogram(size)
    canvas.alpha_composite(glow(glyph, size * 0.035))
    canvas.alpha_composite(glyph)
    if rounded_corners:
        mask = rounded_mask(size, int(size * 0.22))
        rc = Image.new("RGBA", (size, size), (0,0,0,0))
        rc.paste(canvas, (0,0), mask)
        canvas = rc
    canvas.save(os.path.join(OUT, filename))
    print("wrote", filename)

def make_adaptive_layers(size=1024):
    radial_bg(size, BG2, BG).save(os.path.join(OUT, "icon-background.png"))
    inner = int(size * 0.58)
    glyph = draw_monogram(inner)
    fg = Image.new("RGBA", (size, size), (0,0,0,0))
    off = ((size-inner)//2, (size-inner)//2)
    fg.alpha_composite(glow(glyph, inner*0.045), off)
    fg.alpha_composite(glyph, off)
    fg.save(os.path.join(OUT, "icon-foreground.png"))
    print("wrote adaptive layers")

def make_splash(size=2732, filename="splash.png"):
    img = radial_bg(size, BG2, BG)
    glyph_size = int(size * 0.30)
    glyph = draw_monogram(glyph_size)
    off = ((size-glyph_size)//2, int(size*0.34))
    img.alpha_composite(glow(glyph, glyph_size*0.045, boost=1.8), off)
    img.alpha_composite(glyph, off)

    f = font(int(size * 0.05))
    d = ImageDraw.Draw(img)
    text = "MODELZON"
    bbox = d.textbbox((0,0), text, font=f)
    tw = bbox[2]-bbox[0]
    tx, ty = (size-tw)/2, off[1] + glyph_size + size*0.045

    text_layer = Image.new("RGBA", (size, size), (0,0,0,0))
    ImageDraw.Draw(text_layer).text((tx, ty), text, font=f, fill=CYAN)
    img.alpha_composite(glow(text_layer, size*0.006, boost=1.3))
    ImageDraw.Draw(img).text((tx, ty), text, font=f, fill=WHITE)

    sub_f = font(int(size*0.018))
    sub = "Design. Compete. Wear it."
    sd = ImageDraw.Draw(img)
    sbbox = sd.textbbox((0,0), sub, font=sub_f)
    stw = sbbox[2]-sbbox[0]
    sd.text(((size-stw)/2, ty + size*0.07), sub, font=sub_f, fill=(148, 163, 184, 255))

    img.convert("RGB").save(os.path.join(OUT, filename), quality=95)
    print("wrote", filename)

make_icon(1024, "icon.png", rounded_corners=False)
make_icon(512, "icon-512.png", rounded_corners=False)
make_adaptive_layers(1024)
make_splash(2732, "splash.png")
make_splash(2732, "splash-dark.png")
print("DONE")
