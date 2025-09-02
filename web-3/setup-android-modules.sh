#!/data/data/com.termux/files/usr/bin/bash
# Setup pre-compiled node_modules on Android/Termux

set -e

echo "🚀 Setting up pre-compiled node_modules for Android..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this from the project root."
    exit 1
fi

# Check if pre-compiled modules exist
if [ ! -d ".android-modules" ]; then
    echo "❌ Error: .android-modules directory not found."
    echo "Make sure Syncthing has synced the pre-compiled modules."
    echo "Or extract manually: tar -xzf android-modules.tar.gz"
    exit 1
fi

# Remove existing node_modules if present
if [ -d "node_modules" ]; then
    echo "🗑️  Removing existing node_modules..."
    rm -rf node_modules
fi

if [ -d ".pnpm" ]; then
    echo "🗑️  Removing existing .pnpm..."
    rm -rf .pnpm
fi

# Copy pre-compiled modules
echo "📦 Installing pre-compiled modules..."
cp -r .android-modules/node_modules ./
cp -r .android-modules/.pnpm ./

# Create symlinks for global binaries
echo "🔗 Creating binary symlinks..."
mkdir -p node_modules/.bin

# Link common binaries
for bin in prisma tsx next eslint prettier; do
    if [ -f "node_modules/.pnpm/*/node_modules/$bin/bin/$bin" ]; then
        ln -sf "../.pnpm/*/node_modules/$bin/bin/$bin" "node_modules/.bin/$bin"
    fi
done

# Verify Prisma client
echo "✅ Verifying Prisma client..."
if [ -d "node_modules/.prisma/client" ]; then
    echo "   Prisma client found!"
else
    echo "⚠️  Prisma client not found. Generating..."
    npx prisma generate
fi

# Create marker file
date > .android-modules-installed

echo "✅ Pre-compiled modules installed successfully!"
echo ""
echo "You can now run:"
echo "  pnpm run dev"
echo ""
echo "Note: If you add new dependencies on your laptop:"
echo "  1. Run: ./scripts/build-android-modules.sh"
echo "  2. Sync via Syncthing"
echo "  3. Run this script again"