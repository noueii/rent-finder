#!/bin/bash
# Simple method: Use pre-built binaries without Docker

set -e

echo "🚀 Preparing modules for Android (simple method)..."

# Create android-modules directory
ANDROID_MODULES_DIR=".android-modules"
mkdir -p "$ANDROID_MODULES_DIR"

# Copy current node_modules (without native bindings)
echo "📦 Copying JavaScript modules..."
rsync -av --exclude='*.node' \
          --exclude='*.a' \
          --exclude='*.so' \
          --exclude='*.dylib' \
          --exclude='*.dll' \
          --exclude='build/Release' \
          --exclude='prebuilds' \
          --exclude='binding.gyp' \
          node_modules/ "$ANDROID_MODULES_DIR/node_modules/"

# Copy pnpm files
if [ -d ".pnpm" ]; then
    rsync -av .pnpm/ "$ANDROID_MODULES_DIR/.pnpm/"
fi

# Generate Prisma client for multiple platforms
echo "🔨 Generating Prisma client for Android..."
cd "$ANDROID_MODULES_DIR"
PRISMA_CLI_BINARY_TARGETS="linux-arm64-openssl-3.0.x" npx prisma generate
cd ..

# Create info file
cat > "$ANDROID_MODULES_DIR/build-info.txt" << EOF
Built on: $(date)
Method: Simple (no native compilation)
Note: Some packages with native dependencies may not work
EOF

echo "✅ Modules prepared!"
echo "📁 Location: $ANDROID_MODULES_DIR"
echo ""
echo "⚠️  Note: This method skips native compilation."
echo "   PostgreSQL and bcrypt will use pure JS fallbacks (slower)"
echo "   For full performance, use build-android-modules.sh with Docker"