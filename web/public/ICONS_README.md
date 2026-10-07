# Browser Tab Icon (Favicon) Setup

## Current Icons

### ✅ Created
- **icon.svg** - SVG favicon (32x32) with NovusOrbit branding
  - Blue-to-purple gradient background
  - Orbital ring representing career trajectories
  - Central star representing career growth
  - Small dots representing opportunities

### 🔄 To Generate

You need to generate PNG versions from the SVG for better browser support:

#### 1. Favicon (32x32)
```bash
# Using ImageMagick
convert -background none -density 300 icon.svg -resize 32x32 favicon.ico

# Or using inkscape
inkscape icon.svg --export-type=png --export-filename=favicon-32.png -w 32 -h 32
```

#### 2. Apple Touch Icon (180x180)
```bash
# Using ImageMagick
convert -background none -density 300 icon.svg -resize 180x180 apple-touch-icon.png

# Or using inkscape
inkscape icon.svg --export-type=png --export-filename=apple-touch-icon.png -w 180 -h 180
```

#### 3. Alternative: Online Tools
- **Favicon Generator**: https://realfavicongenerator.net/
  - Upload icon.svg
  - Download generated package
  - Extract to /web/public directory

- **CloudConvert**: https://cloudconvert.com/svg-to-png
  - Upload icon.svg
  - Set dimensions (32x32 for favicon, 180x180 for Apple)
  - Download and rename

## Icon Configuration

The icons are configured in `/web/app/layout.tsx`:

```typescript
icons: {
  icon: [
    { url: '/icon.svg', type: 'image/svg+xml' },
    { url: '/favicon.ico', sizes: '32x32' },
  ],
  apple: [
    { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  ],
},
```

## Testing

After generating the PNGs:

1. **Local Development**:
   ```bash
   npm run dev
   ```
   Check browser tab for icon

2. **Production Build**:
   ```bash
   npm run build
   npm start
   ```

3. **Clear Browser Cache**:
   - Chrome: Shift + F5
   - Firefox: Ctrl + Shift + R
   - Safari: Cmd + Option + R

## Browser Support

- **Modern Browsers**: Use icon.svg
- **Safari iOS**: Uses apple-touch-icon.png
- **Legacy Browsers**: Fallback to favicon.ico

## Customization

To customize the icon, edit `/web/app/icon.svg`:

- **Colors**: Change gradient stops in `<linearGradient>`
- **Design**: Modify SVG paths and shapes
- **Size**: SVG is scalable, but regenerate PNGs after changes

## Docker Build

The icon files will be automatically included in the Docker image:

```dockerfile
COPY --from=frontend-builder /app/web/app ./web/app
COPY --from=frontend-builder /app/web/public ./web/public
```

Make sure to regenerate the Docker image after updating icons:

```bash
docker build -t novusorbit:latest .
```
