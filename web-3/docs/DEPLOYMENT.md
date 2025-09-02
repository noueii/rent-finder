# Tokyo Apartment Finder - Deployment Guide

This guide covers deploying the Tokyo Apartment Finder application to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Deployment Options](#deployment-options)
5. [Post-Deployment](#post-deployment)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL 16+
- Docker and Docker Compose (for containerized deployment)
- A domain name (optional but recommended)
- SSL certificate (for HTTPS)

## Environment Setup

### 1. Create Production Environment File

Copy the production example and fill in your values:

```bash
cp .env.production.example .env.production
```

### 2. Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `AUTH_SECRET` | NextAuth secret (generate with `npx auth secret`) | `your-secret-here` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | `your-client-id.apps.googleusercontent.com` |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | `your-client-secret` |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL | `https://yourdomain.com` |

### 3. Optional Environment Variables

- `OTP_ENDPOINT`: OpenTripPlanner API endpoint
- `SENTRY_DSN`: For error tracking
- `RATE_LIMIT_*`: Rate limiting configuration
- `SCRAPING_*`: Web scraping configuration

## Database Setup

### Option 1: Managed PostgreSQL (Recommended)

Use a managed PostgreSQL service for production:

- **Supabase**: Free tier available, good for MVPs
- **Neon**: Serverless PostgreSQL with generous free tier
- **Railway**: Simple deployment with PostgreSQL
- **Amazon RDS**: For larger scale deployments
- **DigitalOcean Managed Databases**: Good balance of price/features

### Option 2: Self-Hosted PostgreSQL

If self-hosting, ensure:
- Regular automated backups
- SSL/TLS enabled
- Proper firewall rules
- Connection pooling configured

### Database Migration

Run migrations before starting the app:

```bash
npx prisma migrate deploy
```

## Deployment Options

### Option 1: Docker Deployment (Recommended)

#### 1. Build the Docker Image

```bash
docker build -t tokyo-apartment-finder .
```

#### 2. Using Docker Compose

For a complete stack with PostgreSQL:

```bash
# Copy and configure environment
cp .env.production.example .env.production
# Edit .env.production with your values

# Start the application
docker-compose -f docker-compose.prod.yml up -d
```

#### 3. Using Docker Run

For just the application:

```bash
docker run -d \
  --name tokyo-apartment-finder \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  tokyo-apartment-finder
```

### Option 2: Traditional Deployment

#### 1. Install Dependencies and Build

```bash
# Run the production build script
chmod +x scripts/build-prod.sh
./scripts/build-prod.sh
```

#### 2. Using PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

#### 3. Using systemd

Create `/etc/systemd/system/tokyo-apartment-finder.service`:

```ini
[Unit]
Description=Tokyo Apartment Finder
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/var/www/tokyo-apartment-finder
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable tokyo-apartment-finder
sudo systemctl start tokyo-apartment-finder
```

### Option 3: Platform-as-a-Service (PaaS)

#### Vercel (Recommended for Next.js)

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel --prod`
3. Configure environment variables in Vercel dashboard

#### Railway

1. Connect GitHub repository
2. Add PostgreSQL database
3. Configure environment variables
4. Deploy automatically on push

#### Heroku

1. Create `Procfile`:
   ```
   web: npm start
   ```
2. Deploy:
   ```bash
   heroku create your-app-name
   heroku addons:create heroku-postgresql:mini
   git push heroku main
   ```

## Post-Deployment

### 1. Verify Health Check

```bash
curl https://yourdomain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-18T...",
  "checks": {
    "database": { "status": "ok" },
    "memory": { "status": "ok" }
  }
}
```

### 2. Set Up SSL/HTTPS

#### Using Nginx (Recommended)

1. Install Nginx and Certbot:
   ```bash
   sudo apt update
   sudo apt install nginx certbot python3-certbot-nginx
   ```

2. Configure Nginx (`/etc/nginx/sites-available/tokyo-apartment-finder`):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. Enable site and get SSL certificate:
   ```bash
   sudo ln -s /etc/nginx/sites-available/tokyo-apartment-finder /etc/nginx/sites-enabled/
   sudo certbot --nginx -d yourdomain.com
   ```

### 3. Set Up Monitoring

#### Application Monitoring

1. **Sentry** (Error Tracking):
   - Create account at sentry.io
   - Add `SENTRY_DSN` to environment
   - Errors will be automatically tracked

2. **Uptime Monitoring**:
   - Use services like:
     - UptimeRobot (free tier)
     - Pingdom
     - StatusCake

#### Server Monitoring

For self-hosted deployments:

```bash
# Install monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d
```

This includes:
- Prometheus (metrics collection)
- Grafana (visualization)
- Node Exporter (system metrics)

### 4. Configure Backups

#### Database Backups

For PostgreSQL:

```bash
# Create backup script
cat > /home/deploy/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATABASE_URL="your-database-url"

mkdir -p $BACKUP_DIR
pg_dump $DATABASE_URL > $BACKUP_DIR/backup_$TIMESTAMP.sql
gzip $BACKUP_DIR/backup_$TIMESTAMP.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /home/deploy/backup-db.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /home/deploy/backup-db.sh" | crontab -
```

## Monitoring & Maintenance

### Health Checks

Monitor these endpoints:

- `/api/health` - Overall application health
- `/api/trpc/healthcheck` - tRPC API health

### Logs

#### Docker Logs

```bash
docker logs -f tokyo-apartment-finder
```

#### PM2 Logs

```bash
pm2 logs tokyo-apartment-finder
```

#### systemd Logs

```bash
journalctl -u tokyo-apartment-finder -f
```

### Performance Optimization

1. **Enable CDN for Static Assets**:
   - Use Cloudflare or similar
   - Cache static assets at edge

2. **Database Optimization**:
   ```sql
   -- Add indexes for common queries
   CREATE INDEX idx_apartments_price ON "Apartment"(price);
   CREATE INDEX idx_apartments_size ON "Apartment"(size);
   CREATE INDEX idx_routes_duration ON "Route"(duration);
   ```

3. **Image Optimization**:
   - Next.js automatically optimizes images
   - Consider using external image CDN for apartment photos

### Regular Maintenance Tasks

1. **Weekly**:
   - Check application logs for errors
   - Review resource usage
   - Verify backups are running

2. **Monthly**:
   - Update dependencies: `npm update`
   - Review and optimize slow queries
   - Check SSL certificate expiration

3. **Quarterly**:
   - Security audit
   - Performance review
   - Capacity planning

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
# Check PostgreSQL is accessible
psql $DATABASE_URL -c "SELECT 1"

# Verify connection string format
# Should be: postgresql://user:password@host:port/database?sslmode=require
```

#### 2. Memory Issues

If experiencing high memory usage:

```javascript
// Add to next.config.js
module.exports = {
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
}
```

#### 3. Build Failures

```bash
# Clear caches and rebuild
rm -rf .next
rm -rf node_modules
npm ci
npm run build
```

#### 4. Authentication Issues

- Verify `AUTH_SECRET` is set correctly
- Check Google OAuth redirect URIs include your domain
- Ensure cookies are properly configured for your domain

### Debug Mode

Enable debug logging:

```bash
DEBUG=* npm start
```

### Performance Profiling

1. **Enable Next.js Analytics**:
   ```bash
   npm install @vercel/analytics
   ```

2. **Use Chrome DevTools**:
   - Check Network tab for slow requests
   - Use Lighthouse for performance audit

## Security Checklist

- [ ] All environment variables are properly set
- [ ] Database uses SSL/TLS connections
- [ ] HTTPS is enabled with valid certificate
- [ ] Security headers are configured (see `next.config.js`)
- [ ] Rate limiting is enabled for API routes
- [ ] Regular security updates are scheduled
- [ ] Backup restoration has been tested
- [ ] Error messages don't expose sensitive information
- [ ] Authentication is properly configured
- [ ] CORS is configured appropriately

## Rollback Procedure

If deployment fails:

### Docker Rollback

```bash
# List previous images
docker images tokyo-apartment-finder

# Run previous version
docker run -d \
  --name tokyo-apartment-finder \
  -p 3000:3000 \
  --env-file .env.production \
  tokyo-apartment-finder:previous-tag
```

### Database Rollback

```bash
# Restore from backup
gunzip < /var/backups/postgres/backup_20250118_020000.sql.gz | psql $DATABASE_URL
```

### Git Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main
```

## Support

For deployment issues:

1. Check application logs
2. Review this guide
3. Check Next.js deployment documentation
4. Review error tracking in Sentry (if configured)

---

*Last updated: January 2025*