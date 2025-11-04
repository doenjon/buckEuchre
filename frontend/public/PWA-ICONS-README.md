# PWA Icon Requirements

The PWA is configured but needs proper app icons to look professional.

## Required Icons

Place these files in the `/frontend/public/` directory:

1. **pwa-192x192.png** (192x192 pixels)
   - Used for Android install prompts and home screen
   - Should be your app logo/icon on solid background

2. **pwa-512x512.png** (512x512 pixels)
   - Used for Android splash screens and high-res displays
   - Same design as 192x192, just higher resolution

3. **apple-touch-icon.png** (180x180 pixels)
   - Used for iOS home screen icon
   - No transparency (iOS adds rounded corners automatically)

4. **favicon.ico** (optional, 32x32 pixels)
   - Browser tab icon

## Design Recommendations

- **Theme**: Card game themed (playing cards, spades/hearts/clubs/diamonds)
- **Colors**: Match your app theme (green #10b981 and dark gray #1f2937)
- **Style**: Simple, recognizable at small sizes
- **Background**: Solid color (not transparent for best compatibility)

## Quick Icon Generation Tools

- **Figma/Canva**: Design once, export at different sizes
- **PWA Asset Generator**: `npx pwa-asset-generator [source-image] public/`
- **RealFaviconGenerator**: https://realfavicongenerator.net/

## Temporary Placeholder

Until you create proper icons, the PWA will use the vite.svg default.
The functionality works, but won't look polished in the app drawer/home screen.

## Testing Your Icons

After adding icons:
1. Clear browser cache
2. Build: `npm run build`
3. Preview: `npm run preview`
4. Test "Add to Home Screen" on mobile device
