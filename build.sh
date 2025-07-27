#!/bin/bash

# Chrome Extension Build Script for Torrent Snag
echo "🔨 Building Torrent Snag Chrome Extension..."

# Clean and build
rm -rf dist/
mkdir -p dist
cp -r src/* dist/

# Validate basic files exist
if [ -f "dist/manifest.json" ] && [ -f "dist/background/background.js" ]; then
    echo "✅ Build completed successfully!"
    echo "📂 Extension files are in the dist/ directory"
    echo "🌐 Load the extension in Chrome: chrome://extensions/ → Load unpacked → select dist/ folder"
    
    # Show file count
    file_count=$(find dist -type f | wc -l)
    echo "📊 Total files: $file_count"
else
    echo "❌ Build failed - required files missing"
    exit 1
fi
