#!/bin/bash
# Build node_modules for Android ARM64 architecture

set -e

echo "🚀 Building node_modules for Android ARM64..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed."
    echo "Install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Create android-modules directory if it doesn't exist
ANDROID_MODULES_DIR=".android-modules"
mkdir -p "$ANDROID_MODULES_DIR"

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -f Dockerfile.android-build -t android-node-builder .

# Create a container and extract the compiled modules
echo "📦 Extracting compiled modules..."
CONTAINER_ID=$(docker create android-node-builder)

# Copy the compiled modules from the container
docker cp "$CONTAINER_ID:/output/node_modules" "$ANDROID_MODULES_DIR/"
docker cp "$CONTAINER_ID:/output/.pnpm" "$ANDROID_MODULES_DIR/" 2>/dev/null || echo "No .pnpm directory to copy"
docker cp "$CONTAINER_ID:/output/build-info.txt" "$ANDROID_MODULES_DIR/"

# Clean up container
docker rm "$CONTAINER_ID"

# Create a tarball for easier transfer (optional)
echo "📦 Creating archive..."
cd "$ANDROID_MODULES_DIR"
tar -czf ../android-modules.tar.gz .
cd ..

# Create sync marker file
date > "$ANDROID_MODULES_DIR/.last-build"

echo "✅ Android modules built successfully!"
echo "📁 Location: $ANDROID_MODULES_DIR"
echo "📦 Archive: android-modules.tar.gz"
echo ""
echo "Next steps:"
echo "1. Modules will sync via Syncthing automatically"
echo "2. On Android, run: ./setup-android-modules.sh"