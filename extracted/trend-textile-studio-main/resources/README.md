# App icon & splash screen — source assets

🔴 Google Play requires a real launcher icon and Play Store listing icon;
without them the app can't be submitted at all. These are generated
(no external tool, no network) and match the app's neon-cyan/obsidian brand.

## What's here
- `icon.png` (1024×1024) — master app icon, also usable as-is for iOS.
- `icon-512.png` — Play Store listing icon (Google wants exactly 512×512).
- `icon-foreground.png` / `icon-background.png` (1024×1024) — Android
  **adaptive icon** layers (Android 8+ masks these into a circle/squircle/
  rounded-square depending on the device's launcher — that's why the glyph
  is kept inside a safe inner zone on the foreground layer).
- `splash.png` / `splash-dark.png` (2732×2732) — launch screen, sized for
  Capacitor's splash-generation convention (covers every device down to
  the smallest crop).
- `play-feature-graphic.png` (1024×500) — Google Play Store listing's
  required "feature graphic" (the wide banner at the top of the listing).
  ⚠️ You still need actual **in-app screenshots** (min 2, Google wants
  phone screenshots at real device resolution) — those have to be captured
  from the live running app, which isn't possible from this offline
  sandbox. Easiest path: open the published app on a phone (or Chrome
  DevTools device emulation) and screenshot the Studio, Arena, and
  Marketplace tabs.

## Turn these into the actual Android resources (one command, needs npm)
This couldn't be run in the sandbox that produced these files (no network
access there). In Lovable, or any machine with Node:

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --android
```

That reads everything in `resources/` and writes every density
(mipmap-mdpi…xxxhdpi, drawable splash variants) straight into
`android/app/src/main/res/`, and wires the adaptive icon XML automatically.

If you'd rather not add a dev dependency, you can instead point Android
Studio's built-in **Image Asset Studio** (right-click `res/` → New → Image
Asset) at `icon-foreground.png` + `icon-background.png` for the launcher
icon, and manually drop `splash.png` into `res/drawable/splash.png`.

## Regenerating / tweaking the design
`generate-icons.py` (plain Python + Pillow, no other dependencies) built
everything above. Run `python3 generate-icons.py` from inside `resources/`
to regenerate, or edit the `CYAN`/`BG` colors or `draw_monogram()` glyph
first if you want a different look.
