#!/usr/bin/env bash
# Build script for Render deployment

set -o errexit

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Create necessary directories
mkdir -p static/uploads

echo "Build completed successfully!"