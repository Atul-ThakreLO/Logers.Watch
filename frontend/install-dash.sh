#!/bin/bash

# Installation script for DASH Video Player with bun
echo "Installing DASH Video Player dependencies with bun..."

# Install dashjs with bun
echo "Installing dashjs..."
bun add dashjs

echo "Dependencies installed successfully!"
echo ""
echo "Usage:"
echo "1. For regular videos: <VideoPlayer src='/video.mp4' poster='/poster.jpg' />"
echo "2. For DASH videos: <VideoPlayer src='/manifest.mpd' poster='/poster.jpg' isDash={true} />"
echo ""
echo "Your DASH video player is ready to use!"