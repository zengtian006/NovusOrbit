#!/bin/bash

# ============================================
# Generate Favicon and Apple Touch Icons
# ============================================
# This script converts the SVG icon to PNG formats
# Requires: ImageMagick or Inkscape

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/public"
APP_DIR="$SCRIPT_DIR/app"
SVG_FILE="$APP_DIR/icon.svg"

echo "🎨 Generating icons from $SVG_FILE..."

# Check if SVG exists
if [ ! -f "$SVG_FILE" ]; then
    echo "❌ Error: icon.svg not found in $APP_DIR"
    exit 1
fi

# Check for ImageMagick
if command -v convert &> /dev/null; then
    echo "✓ Using ImageMagick"
    
    # Generate favicon (32x32)
    echo "  → Generating favicon.ico (32x32)..."
    convert -background none -density 300 "$SVG_FILE" -resize 32x32 "$PUBLIC_DIR/favicon.ico"
    
    # Generate Apple Touch Icon (180x180)
    echo "  → Generating apple-touch-icon.png (180x180)..."
    convert -background none -density 300 "$SVG_FILE" -resize 180x180 "$PUBLIC_DIR/apple-touch-icon.png"
    
    echo "✅ Icons generated successfully!"
    echo ""
    echo "Generated files:"
    ls -lh "$PUBLIC_DIR/favicon.ico" "$PUBLIC_DIR/apple-touch-icon.png"
    
elif command -v inkscape &> /dev/null; then
    echo "✓ Using Inkscape"
    
    # Generate favicon (32x32)
    echo "  → Generating favicon-32.png (32x32)..."
    inkscape "$SVG_FILE" --export-type=png --export-filename="$PUBLIC_DIR/favicon-32.png" -w 32 -h 32
    
    # Convert PNG to ICO (if ImageMagick is available)
    if command -v convert &> /dev/null; then
        echo "  → Converting to favicon.ico..."
        convert "$PUBLIC_DIR/favicon-32.png" "$PUBLIC_DIR/favicon.ico"
        rm "$PUBLIC_DIR/favicon-32.png"
    else
        echo "  ⚠️  ImageMagick not found. Keeping favicon-32.png (rename to favicon.ico or use online converter)"
    fi
    
    # Generate Apple Touch Icon (180x180)
    echo "  → Generating apple-touch-icon.png (180x180)..."
    inkscape "$SVG_FILE" --export-type=png --export-filename="$PUBLIC_DIR/apple-touch-icon.png" -w 180 -h 180
    
    echo "✅ Icons generated successfully!"
    echo ""
    echo "Generated files:"
    ls -lh "$PUBLIC_DIR"/*.{ico,png} 2>/dev/null || ls -lh "$PUBLIC_DIR"/favicon-32.png "$PUBLIC_DIR/apple-touch-icon.png"
    
else
    echo "❌ Error: Neither ImageMagick nor Inkscape found"
    echo ""
    echo "Please install one of the following:"
    echo ""
    echo "macOS:"
    echo "  brew install imagemagick"
    echo "  # or"
    echo "  brew install inkscape"
    echo ""
    echo "Ubuntu/Debian:"
    echo "  sudo apt-get install imagemagick"
    echo "  # or"
    echo "  sudo apt-get install inkscape"
    echo ""
    echo "Alternative: Use online tools"
    echo "  → https://realfavicongenerator.net/"
    echo "  → https://cloudconvert.com/svg-to-png"
    exit 1
fi

echo ""
echo "📋 Next steps:"
echo "  1. Check the generated icons in $PUBLIC_DIR"
echo "  2. Clear browser cache (Shift+F5)"
echo "  3. Restart dev server: npm run dev"
echo "  4. Rebuild Docker image if deploying: docker build -t novusorbit:latest ."
