# Public Assets for SEO

This folder contains static assets required for optimal SEO and web presence.

## Required Files

### Favicons & Icons
- **favicon.ico** - Main favicon (16x16, 32x32, 48x48)
- **icon-192.png** - PWA icon (192x192)
- **icon-512.png** - PWA icon (512x512)
- **apple-touch-icon.png** - iOS home screen icon (180x180)

### Social Media Images
- **og-image.png** - Open Graph image for social sharing (1200x630)
  - Used when sharing on Facebook, LinkedIn, etc.
  - Should include your logo and tagline

### Existing Files
- **logo.png** - Main logo (currently present)

## Creating Icons

You can generate all required icons from a single high-resolution logo using:

### Online Tools
- [Favicon Generator](https://realfavicongenerator.net/)
- [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)

### Command Line (ImageMagick)
```bash
# From a high-res logo (1024x1024 or larger)
convert logo.png -resize 192x192 icon-192.png
convert logo.png -resize 512x512 icon-512.png
convert logo.png -resize 180x180 apple-touch-icon.png
convert logo.png -resize 16x16 favicon-16.png
convert logo.png -resize 32x32 favicon-32.png
convert favicon-16.png favicon-32.png favicon.ico

# OG Image (1200x630 with text overlay)
convert logo.png -resize 400x400 -background '#667eea' -gravity center -extent 1200x630 og-image.png
```

### Design Tips
- Use transparent backgrounds for icons
- Ensure logo is clearly visible at small sizes
- OG image should include text describing your service
- Use your brand colors consistently

## Current Status
✓ logo.png - Present
⚠️  Missing: favicon.ico, icon-192.png, icon-512.png, og-image.png, apple-touch-icon.png

## Note
Until proper icons are created, the site will use default browser icons, which is not ideal for SEO and user experience.
