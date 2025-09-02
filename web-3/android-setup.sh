#!/bin/bash
# Script to set up Android build

# Install Capacitor
npm install @capacitor/core @capacitor/android @capacitor/cli

# Initialize Capacitor
npx cap init "Tokyo Apartment Finder" "com.tokyoapt.finder" --web-dir=.next

# Add Android platform
npx cap add android

# Update Capacitor config
cat > capacitor.config.json << EOF
{
  "appId": "com.tokyoapt.finder",
  "appName": "Tokyo Apartment Finder",
  "webDir": ".next",
  "server": {
    "url": "http://localhost:3000",
    "cleartext": true
  },
  "android": {
    "allowMixedContent": true
  }
}
EOF

# Build Next.js as static export
echo "Building static export..."
npm run build

# Sync to Android
npx cap sync android

echo "Android project created in android/ directory"
echo "Open in Android Studio: npx cap open android"