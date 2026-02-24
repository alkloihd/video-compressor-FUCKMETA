#!/bin/bash
# Video Compressor — Double-click to launch
cd "$(dirname "$0")"

if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed."
    echo "Install it from https://nodejs.org or via: brew install node"
    read -p "Press Enter to exit..."
    exit 1
fi

if ! command -v ffmpeg &> /dev/null; then
    echo "Error: FFmpeg is not installed."
    echo "Install it via: brew install ffmpeg"
    read -p "Press Enter to exit..."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --silent 2>/dev/null
fi

echo ""
echo "  Starting Video Compressor..."
echo "  Opening http://localhost:3000"
echo ""

(sleep 1.5 && open http://localhost:3000) &
node server.js
