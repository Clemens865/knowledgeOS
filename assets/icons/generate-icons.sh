#!/bin/bash

# Icon Generation Script for KnowledgeOS
# This script helps generate all required icon formats from a base PNG image

echo "KnowledgeOS Icon Generator"
echo "=========================="
echo ""
echo "This script will help you generate all required icon formats."
echo "Please ensure you have your base icon as 'icon.png' (1024x1024) in this directory."
echo ""

# Check if icon.png exists
if [ ! -f "icon.png" ]; then
    echo "ERROR: icon.png not found in current directory!"
    echo "Please save your icon as 'icon.png' (1024x1024 pixels) and run this script again."
    exit 1
fi

# Check for required tools
if ! command -v sips &> /dev/null; then
    echo "WARNING: 'sips' command not found. This is required for macOS icon generation."
fi

echo "Generating icon sizes..."

# Generate different PNG sizes (using sips on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Generating PNG sizes for macOS..."
    sips -z 16 16     icon.png --out icon_16x16.png
    sips -z 32 32     icon.png --out icon_32x32.png
    sips -z 64 64     icon.png --out icon_64x64.png
    sips -z 128 128   icon.png --out icon_128x128.png
    sips -z 256 256   icon.png --out icon_256x256.png
    sips -z 512 512   icon.png --out icon_512x512.png
    sips -z 1024 1024 icon.png --out icon_1024x1024.png
    
    # Create iconset for macOS
    echo "Creating macOS iconset..."
    mkdir -p icon.iconset
    sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
    sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
    sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
    sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
    sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
    sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
    sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
    sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
    sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
    sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
    
    # Convert to icns
    echo "Converting to ICNS format..."
    iconutil -c icns icon.iconset -o icon.icns
    
    # Clean up iconset
    rm -rf icon.iconset
    
    echo "✅ macOS icon (icon.icns) generated successfully!"
else
    echo "Not on macOS. Skipping ICNS generation."
    echo "Please use an online converter or macOS to generate icon.icns"
fi

echo ""
echo "Icon generation complete!"
echo ""
echo "Next steps:"
echo "1. For Windows (.ico), use an online converter like:"
echo "   https://cloudconvert.com/png-to-ico"
echo "   Upload your icon.png and download as icon.ico"
echo ""
echo "2. Place the generated files in this directory:"
echo "   - icon.icns (macOS)"
echo "   - icon.ico (Windows)"
echo "   - icon.png (Linux/fallback)"
echo ""
echo "3. Rebuild your app with: npm run build"
echo "4. Package your app with: npm run package"