# Buck Euchre - Production Deployment Guide

**Version:** 1.0  
**Last Updated:** 2025-10-05

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Environment Configuration](#environment-configuration)
5. [Initial Deployment](#initial-deployment)
6. [Database Management](#database-management)
7. [Monitoring & Logging](#monitoring--logging)
8. [Backup & Recovery](#backup--recovery)
9. [Scaling Considerations](#scaling-considerations)
10. [AWS Lightsail Notes](#aws-lightsail-notes)
11. [Security Hardening](#security-hardening)
12. [Troubleshooting](#troubleshooting)
13. [Maintenance](#maintenance)

---

## Overview

Buck Euchre is deployed using Docker Compose with the following services:
- **PostgreSQL 16** - Database
- **Backend** - Node.js/Express API with Socket.IO
- **Frontend** - React SPA served by Nginx
- **Nginx** - Reverse proxy and load balancer

### Architecture

```
Internet
   ↓
Nginx Reverse Proxy (Port 80/443)
   ├── Frontend (Static React App)
   ├── Backend API (/api/*)
   └── WebSocket (/socket.io/*)
        ↓
   PostgreSQL (Internal Network)
```

---

## Prerequisites

### Server Requirements

**Minimum Specifications:**
- **CPU:** 2 cores
- **RAM:** 4 GB
- **Storage:** 20 GB SSD
- **OS:** Ubuntu 22.04 LTS (recommended) or similar Linux distribution

**Recommended Specifications (Production):**
- **CPU:** 4+ cores
- **RAM:** 8+ GB
- **Storage:** 50+ GB SSD
- **OS:** Ubuntu 22.04 LTS

### Software Requirements

1. **Docker** (version 24.0+)
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

2. **Docker Compose** (version 2.0+)
   ```bash
   sudo apt-get install docker-compose-plugin
   ```

3. **Git**
   ```bash
   sudo apt-get install git
   ```

4. **(Optional) Nginx** - For HTTPS termination with Let's Encrypt

### Domain & DNS

- Domain name pointed to your server's IP address
- DNS A record: `yourdomain.com` → `YOUR_SERVER_IP`
- (Optional) DNS A record: `www.yourdomain.com` → `YOUR_SERVER_IP`

---

## Infrastructure Setup

### 1. Firewall Configuration

```bash
# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Verify status
sudo ufw status
```

### 2. Create Application User

```bash
# Create non-root user for running the application
sudo useradd -m -s /bin/bash buckeuchre
sudo usermod -aG docker buckeuchre

# Switch to application user
sudo su - buckeuchre
```

### 3. Clone Repository

```bash
cd /home/buckeuchre
git clone <your-repository-url> buck-euchre
cd buck-euchre
```

---

## Environment Configuration

### 1. Generate Secure Credentials

```bash
# Generate PostgreSQL password (32 characters)
openssl rand -base64 32

# Generate JWT secret (64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Create Production Environment File

```bash
# Copy example file
cp .env.production.example .env.production

# Edit with your favorite editor
nano .env.production
```

**Update the following variables:**

```bash
# PostgreSQL
POSTGRES_PASSWORD=<generated-password>

# JWT
JWT_SECRET=<generated-secret>

# URLs (replace with your domain)
CORS_ORIGIN=https://yourdomain.com
DATABASE_URL=postgresql://buckeuchre:<generated-password>@postgres:5432/buckeuchre?sslmode=prefer

# Ports (default)
HTTP_PORT=80
HTTPS_PORT=443
```

### 3. Configure Backend Environment

```bash
# Copy and edit backend environment
cp backend/.env.example backend/.env
nano backend/.env
```

Update to match your `.env.production`:
```bash
DATABASE_URL=<same-as-above>
JWT_SECRET=<same-as-above>
CORS_ORIGIN=https://yourdomain.com
NODE_ENV=production
```

### 4. Configure Frontend Environment

```bash
# Copy and edit frontend environment
cp frontend/.env.example frontend/.env
nano frontend/.env
```

Update API URLs:
```bash
VITE_API_URL=https://yourdomain.com
VITE_WS_URL=https://yourdomain.com
```

---

## Initial Deployment

### Option A: Using Deployment Script (Recommended)

```bash
# Make script executable (if not already)
chmod +x production-start.sh

# Run deployment script
./production-start.sh
```

The script will:
1. Validate environment variables
2. Pull and build Docker images
3. Start all services
4. Wait for health checks
5. Display service status

### Option B: Manual Deployment

```bash
# Pull latest images
docker-compose pull

# Build custom images
docker-compose build --no-cache

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Verify Deployment

```bash
# Check all services are healthy
docker-compose ps

# Test health endpoints
curl http://localhost/health        # Should return "healthy"
curl http://localhost/api/health    # Should return service info

# View logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres
```

---

## Database Management

### Initial Setup

The database migrations run automatically on backend startup. If you need to run them manually:

```bash
docker-compose exec backend npx prisma migrate deploy
```

### Database Backups

#### Automated Backups

```bash
# Run backup script
./backup-database.sh
```

Backups are stored in `./backups/` with timestamp:
```
backups/buckeuchre_backup_20231015_120000.sql
```

#### Schedule Automated Backups (Cron)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /home/buckeuchre/buck-euchre/backup-database.sh
```

### Database Restore

```bash
# List available backups
ls -lh backups/

# Restore from backup
./restore-database.sh backups/buckeuchre_backup_20231015_120000.sql
```

### Manual Database Access

```bash
# Connect to PostgreSQL
docker exec -it buckeuchre-postgres psql -U buckeuchre -d buckeuchre

# Common queries
\dt                           # List tables
\d+ games                     # Describe games table
SELECT COUNT(*) FROM games;   # Count games
\q                            # Quit
```

---

## Monitoring & Logging

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Log Rotation

Create log rotation configuration:

```bash
sudo nano /etc/logrotate.d/docker-containers
```

Add:
```
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=10M
    missingok
    delaycompress
    copytruncate
}
```

### Health Checks

```bash
# Check service health
docker-compose ps

# Manual health check
curl http://localhost/health
curl http://localhost/api/health
```

### Monitoring Setup (Recommended)

1. **Application Performance Monitoring (APM)**
   - New Relic
   - DataDog
   - Sentry (for error tracking)

2. **Infrastructure Monitoring**
   - Prometheus + Grafana
   - CloudWatch (AWS)
   - DigitalOcean Monitoring

3. **Uptime Monitoring**
   - UptimeRobot
   - Pingdom
   - StatusCake

---

## Backup & Recovery

### Backup Strategy

**What to Backup:**
1. Database (PostgreSQL dumps)
2. Docker volumes (optional)
3. Environment configuration files (securely)
4. Application code (Git repository)

**Backup Schedule:**
- **Daily:** Database backups (retained for 7 days)
- **Weekly:** Full system backup (retained for 4 weeks)
- **Monthly:** Long-term backup (retained for 1 year)

### Database Backup

```bash
# Create backup
./backup-database.sh

# Automated backups (cron)
0 2 * * * /home/buckeuchre/buck-euchre/backup-database.sh
```

### Disaster Recovery

**Complete System Failure:**

1. **Set up new server** (follow Infrastructure Setup)
2. **Clone repository**
3. **Restore configuration**
   ```bash
   # Copy backed-up .env files
   ```
4. **Start services**
   ```bash
   ./production-start.sh
   ```
5. **Restore database**
   ```bash
   ./restore-database.sh backups/latest_backup.sql
   ```

---

## Scaling Considerations

### Vertical Scaling (Single Server)

**Current Setup Supports:**
- Up to 100 concurrent games (~400 connections)
- ~1000 requests per second

**To Scale Up:**
1. Increase server resources (CPU, RAM)
2. Adjust Docker resource limits in `docker-compose.yml`
3. Optimize PostgreSQL configuration

### Horizontal Scaling (Multiple Servers)

**Requirements:**
1. **Load Balancer** (Nginx, HAProxy, AWS ALB)
2. **Shared Database** (Managed PostgreSQL, RDS)
3. **Redis** for session storage and pub/sub
4. **WebSocket Sticky Sessions** (required for Socket.IO)

**Architecture Changes Needed:**
- Replace in-memory game state with Redis
- Configure Socket.IO adapter for Redis
- Use external session store
- Implement database connection pooling

### Database Scaling

1. **Connection Pooling** (PgBouncer)
2. **Read Replicas** for read-heavy workloads
3. **Managed Database** (AWS RDS, DigitalOcean Managed Database)

---

## AWS Lightsail Notes

### Upgrading an Instance

Lightsail bundles do not support in-place resizing. To move to a larger or smaller plan:
1. Create a snapshot of the current instance (Snapshots tab → **Create snapshot**).
2. Launch a new instance from that snapshot, choosing the desired bundle size.
3. Reassign the static IP or update DNS records to point traffic at the new instance.
4. Decommission the old instance after verifying the new one is healthy.

This approach minimizes downtime—you only need a brief cutover while swapping DNS or the static IP.

### Lightsail Containers vs. Docker Compose

- **Lightsail Containers** run one container image per service with optional scaling and HTTPS. They do not provide multi-container definitions, shared Compose networks, or named volumes.
- **Docker Compose workflow** (current project setup) requires a standard Lightsail instance, EC2, or another host where you install Docker/Compose and manage the stack yourself.

If you depend on `docker-compose` features, continue using a Lightsail instance (or move to ECS/EKS) rather than Lightsail Containers.

### Sustainable CPU Usage Graph

- Lightsail bundles use burstable CPUs. The “Sustainable CPU usage” line shows the baseline percentage you can run 24/7 without consuming burst credits (often ~5% per vCPU on small plans).
- Using more CPU than that baseline burns credits; when credits run out, the instance is throttled back to the sustainable level.
- Persistently higher workloads should move to a larger bundle or to EC2 families with dedicated CPU (e.g., M or C-series).

Monitor the CPU credit balance in Lightsail to ensure workloads stay within sustainable limits.

---

## Security Hardening

### SSL/TLS Configuration

#### Option A: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (already configured by certbot)
sudo certbot renew --dry-run
```

#### Option B: Custom SSL Certificate

1. Place certificates in `nginx/ssl/`
   - `fullchain.pem`
   - `privkey.pem`

2. Uncomment HTTPS configuration in `nginx/conf.d/buckeuchre.conf`

3. Restart nginx:
   ```bash
   docker-compose restart nginx
   ```

### Additional Security Measures

1. **Rate Limiting** (configured in nginx)
   - API: 10 req/sec per IP
   - Auth: 5 req/sec per IP

2. **Security Headers** (configured in nginx)
   - X-Content-Type-Options
   - X-Frame-Options
   - X-XSS-Protection
   - Referrer-Policy
   - HSTS (when HTTPS is enabled)

3. **Database Security**
   - Use strong passwords (32+ characters)
   - Enable SSL connections (`sslmode=require`)
   - Restrict database access to internal network only

4. **Environment Variables**
   - Never commit `.env` files to version control
   - Use secrets management (AWS Secrets Manager, HashiCorp Vault)
   - Rotate credentials regularly

5. **Firewall Configuration**
   - Only expose ports 80 and 443
   - Use UFW or iptables
   - Consider fail2ban for SSH protection

---

## Troubleshooting

### Services Not Starting

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs backend

# Check for port conflicts
sudo netstat -tulpn | grep LISTEN

# Restart services
docker-compose restart
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Verify DATABASE_URL in backend/.env
docker-compose exec backend env | grep DATABASE_URL

# Test connection manually
docker exec -it buckeuchre-postgres psql -U buckeuchre -d buckeuchre
```

### WebSocket Connection Issues

1. **Check CORS configuration**
   - Verify `CORS_ORIGIN` matches frontend domain
   
2. **Check nginx WebSocket proxy**
   - Ensure `Upgrade` and `Connection` headers are set
   
3. **Check firewall**
   - Ensure WebSocket traffic is allowed

4. **Test WebSocket endpoint**
   ```bash
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost/socket.io/
   ```

### High CPU/Memory Usage

```bash
# Check resource usage
docker stats

# Check specific container
docker stats buckeuchre-backend

# Limit resources in docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
```

### Slow Performance

1. **Database Optimization**
   ```bash
   # Check query performance
   docker exec -it buckeuchre-postgres psql -U buckeuchre -d buckeuchre
   EXPLAIN ANALYZE SELECT * FROM games;
   
   # Add indexes if needed
   CREATE INDEX idx_games_status ON games(status);
   ```

2. **Connection Pooling**
   - Consider using PgBouncer
   - Adjust Prisma connection pool settings

3. **Caching**
   - Implement Redis for frequently accessed data
   - Use CDN for static assets

---

## Maintenance

### Updating the Application

```bash
# 1. Backup database
./backup-database.sh

# 2. Pull latest code
git pull origin main

# 3. Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 4. Verify
docker-compose ps
docker-compose logs -f
```

### Database Migrations

```bash
# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Check migration status
docker-compose exec backend npx prisma migrate status
```

### Cleaning Up

```bash
# Remove unused Docker images
docker system prune -a

# Remove old logs (older than 7 days)
find /var/lib/docker/containers -name "*.log" -mtime +7 -delete

# Remove old backups (keep last 30 days)
find backups -name "*.sql" -mtime +30 -delete
```

### Regular Maintenance Tasks

**Daily:**
- Monitor application logs
- Check service health
- Verify backups completed

**Weekly:**
- Review error logs
- Check disk space usage
- Update system packages

**Monthly:**
- Review security patches
- Test backup restoration
- Review and rotate access logs
- Update Docker images

---

## Production Checklist

Before going live, verify:

### Configuration
- [ ] All environment variables set with production values
- [ ] Strong passwords generated (32+ characters)
- [ ] JWT_SECRET is unique and secure
- [ ] CORS_ORIGIN set to production domain
- [ ] Database URL uses production credentials
- [ ] NODE_ENV set to "production"

### Security
- [ ] SSL/TLS certificates configured
- [ ] HTTPS redirect enabled
- [ ] Security headers configured
- [ ] Firewall rules applied (only 80/443 open)
- [ ] Database SSL enabled
- [ ] Rate limiting configured
- [ ] Secrets not in version control

### Infrastructure
- [ ] Server meets minimum requirements
- [ ] Docker and Docker Compose installed
- [ ] DNS records configured
- [ ] Domain pointed to server
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Log rotation configured

### Application
- [ ] All services start successfully
- [ ] Health checks passing
- [ ] Database migrations applied
- [ ] WebSocket connections working
- [ ] Frontend accessible
- [ ] API endpoints responding
- [ ] Test game can be played

### Documentation
- [ ] Deployment documented
- [ ] Runbooks created
- [ ] Emergency contacts defined
- [ ] Backup/restore procedures tested

---

## Support & Resources

### Documentation
- [README.md](./README.md) - Project overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [API_SPEC.md](./API_SPEC.md) - API documentation
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing information

### Useful Commands

```bash
# Quick status check
docker-compose ps

# View all logs
docker-compose logs -f

# Restart all services
docker-compose restart

# Stop all services
docker-compose down

# Start all services
docker-compose up -d

# Rebuild specific service
docker-compose build backend
docker-compose up -d backend

# Execute command in container
docker-compose exec backend npm run migrate

# Shell access
docker-compose exec backend sh
docker-compose exec postgres psql -U buckeuchre -d buckeuchre
```

---

## Contact & Emergency Procedures

### Emergency Response

**Service Down:**
1. Check service status: `docker-compose ps`
2. View logs: `docker-compose logs <service>`
3. Restart service: `docker-compose restart <service>`
4. If issue persists, restore from backup

**Data Loss:**
1. Stop all services: `docker-compose down`
2. Restore database: `./restore-database.sh <backup-file>`
3. Restart services: `docker-compose up -d`
4. Verify data integrity

**Security Incident:**
1. Isolate affected systems
2. Review logs for suspicious activity
3. Rotate all credentials
4. Apply security patches
5. Notify users if data was compromised

---

**Last Updated:** 2025-10-05  
**Version:** 1.0
