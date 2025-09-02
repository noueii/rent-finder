# Troubleshooting Guide

## Docker Connection Issues

If you're getting Docker registry connection errors, try these solutions:

### 1. Check Docker Service
```bash
# Check if Docker is running
docker ps

# Restart Docker if needed
sudo systemctl restart docker  # Linux
# Or restart Docker Desktop on Mac/Windows
```

### 2. DNS Issues
The error mentions DNS resolution problems. Try:

```bash
# Test Docker connectivity
docker pull hello-world

# If that fails, check DNS settings
cat /etc/resolv.conf

# Try using Google DNS
sudo bash -c 'echo "nameserver 8.8.8.8" > /etc/resolv.conf'
```

### 3. Proxy Issues
If you're behind a corporate proxy:

```bash
# Configure Docker proxy
mkdir -p ~/.docker
cat > ~/.docker/config.json << EOF
{
  "proxies": {
    "default": {
      "httpProxy": "http://your-proxy:port",
      "httpsProxy": "http://your-proxy:port",
      "noProxy": "localhost,127.0.0.1"
    }
  }
}
EOF
```

### 4. Use Alternative Registry
Try pulling from a different registry:

```bash
# Use GitHub Container Registry mirror
docker pull ghcr.io/opentripplanner/opentripplanner:latest

# Or pull directly with full URL
docker pull docker.io/opentripplanner/opentripplanner:2.5.0
```

### 5. Manual Download Option
If Docker pull continues to fail, you can run OTP manually:

1. Download OTP JAR directly:
```bash
wget https://github.com/opentripplanner/OpenTripPlanner/releases/download/v2.5.0/otp-2.5.0-shaded.jar
```

2. Run without Docker:
```bash
java -Xmx4G -jar otp-2.5.0-shaded.jar --build --serve --basePath ./data
```

## Alternative: Use Docker Compose with Specific Version

Try using the alternative compose file:

```bash
docker-compose -f docker-compose-alt.yml up -d
```

This uses a specific version (2.5.0) instead of 'latest' tag.

## Network Timeout Issues

If the download is timing out:

1. **Increase Docker timeout**:
```bash
export DOCKER_CLIENT_TIMEOUT=600
export COMPOSE_HTTP_TIMEOUT=600
```

2. **Pre-pull the image**:
```bash
docker pull opentripplanner/opentripplanner:2.5.0 --verbose
```

## Building OTP from Source

As a last resort, build OTP locally:

```bash
# Clone OTP
git clone https://github.com/opentripplanner/OpenTripPlanner.git
cd OpenTripPlanner

# Build with Maven
mvn clean package -DskipTests

# Use the built JAR
java -Xmx4G -jar target/otp-*-shaded.jar --build --serve
```