#!/bin/bash
# Fix Docker DNS issues

echo "🔧 Fixing Docker DNS Configuration"
echo "=================================="

# Check current Docker DNS
echo "Current Docker DNS settings:"
docker info | grep -A 2 "Registry"

# Option 1: Restart Docker daemon
echo ""
echo "Option 1: Restart Docker"
echo "------------------------"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "On macOS: Restart Docker Desktop from the menu bar"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Run: sudo systemctl restart docker"
fi

# Option 2: Configure Docker daemon DNS
echo ""
echo "Option 2: Configure Docker DNS"
echo "------------------------------"
echo "Add this to /etc/docker/daemon.json (create if doesn't exist):"
echo '{'
echo '  "dns": ["8.8.8.8", "8.8.4.4"]'
echo '}'

# Option 3: Pull through proxy
echo ""
echo "Option 3: Use a Docker registry proxy"
echo "-------------------------------------"
echo "Try pulling through a mirror:"
echo "docker pull mirror.gcr.io/opentripplanner/opentripplanner:latest"

# Test connectivity
echo ""
echo "Test Docker connectivity with:"
echo "docker pull hello-world"