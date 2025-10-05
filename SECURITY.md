# Security Guidelines

## Overview

This document outlines security best practices for the Buck Euchre application.

---

## Environment Variables & Secrets

### ⚠️ CRITICAL: Never Commit Secrets

**Files that must NEVER be committed:**
- `.env`
- `.env.local`
- `.env.*.local`
- Any file containing passwords, API keys, or secrets

**Already protected by `.gitignore`:**
```
.env
.env.local
.env.*.local
**/.env
**/.env.local
```

### Setting Up Secrets

1. **Copy the example file:**
   ```bash
   cp env.example .env
   ```

2. **Generate secure passwords:**
   ```bash
   # Generate a secure random password
   openssl rand -base64 32
   
   # Or use a password manager
   ```

3. **Set required environment variables:**
   ```bash
   # In .env file
   DB_PASSWORD="your_secure_random_password_here"
   JWT_SECRET="your_secure_random_jwt_secret_min_32_chars"
   ```

### Required Secrets

| Variable | Purpose | Requirements |
|----------|---------|--------------|
| `DB_PASSWORD` | PostgreSQL password | Strong random string (16+ chars) |
| `JWT_SECRET` | JWT token signing | Random string (32+ chars recommended) |
| `DATABASE_URL` | Full DB connection | Includes DB_PASSWORD |

---

## Database Security

### PostgreSQL Configuration

**Development:**
```bash
# Use environment variables
docker run -d --name buckeuchre-postgres \
  -e POSTGRES_USER=buckeuchre \
  -e POSTGRES_PASSWORD=${DB_PASSWORD} \
  -e POSTGRES_DB=buckeuchre \
  postgres:16-alpine
```

**Production:**
- Use managed database services (AWS RDS, Google Cloud SQL, etc.)
- Enable SSL/TLS connections
- Restrict network access (firewall rules)
- Regular automated backups
- Strong password policies

### Connection String Security

❌ **NEVER do this:**
```bash
DATABASE_URL="postgresql://user:password123@localhost/db"
```

✅ **DO this:**
```bash
DB_PASSWORD="$(openssl rand -base64 32)"
DATABASE_URL="postgresql://user:${DB_PASSWORD}@localhost/db"
```

---

## JWT Token Security

### Secret Key Requirements

- **Minimum length:** 32 characters
- **Character set:** Alphanumeric + special characters
- **Generation:** Use cryptographically secure random generation
- **Rotation:** Rotate secrets periodically (every 90 days recommended)

### Generate Secure JWT Secret

```bash
# Option 1: OpenSSL
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: /dev/urandom (Linux/Mac)
head -c 32 /dev/urandom | base64
```

### JWT Best Practices

- ✅ Short expiration times (24h for development, 15m-1h for production)
- ✅ Store secrets in environment variables only
- ✅ Use HTTPS in production
- ✅ Implement refresh token rotation
- ❌ Never log JWT tokens
- ❌ Never store tokens in localStorage (use httpOnly cookies)

---

## API Security

### CORS Configuration

**Development:**
```bash
CORS_ORIGIN="http://localhost:5173"
```

**Production:**
```bash
CORS_ORIGIN="https://yourdomain.com"
```

### Rate Limiting

Consider implementing rate limiting for production:
- Authentication endpoints: 5 requests/minute
- API endpoints: 100 requests/minute
- WebSocket connections: 10 connections/IP

---

## WebSocket Security

### Authentication

- ✅ Authenticate on connection (JWT in handshake)
- ✅ Validate tokens on every message
- ✅ Disconnect on authentication failure
- ✅ Implement connection timeouts

### Message Validation

- ✅ Validate all incoming messages
- ✅ Sanitize user input
- ✅ Rate limit messages per connection
- ✅ Implement message size limits

---

## Input Validation

### Player Names

```typescript
// ✅ Validated and sanitized
const playerName = input.trim();
if (playerName.length === 0 || playerName.length > 50) {
  throw new ValidationError('Invalid player name');
}
```

### Game Actions

- ✅ Validate card IDs against player's hand
- ✅ Validate game phase for actions
- ✅ Validate player turn
- ✅ Sanitize all user input

---

## Production Deployment

### Environment Setup

**Required for production:**
```bash
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
DB_PASSWORD=<strong-random-password>
DATABASE_URL=<connection-with-ssl>
CORS_ORIGIN=<your-production-domain>
```

### Security Headers

Implement security headers in production:
```javascript
// Helmet.js recommended
app.use(helmet());

// Manual configuration
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});
```

### HTTPS

- ✅ Always use HTTPS in production
- ✅ Redirect HTTP to HTTPS
- ✅ Use TLS 1.2 or higher
- ✅ Valid SSL certificates

---

## Monitoring & Logging

### What to Log

✅ **DO log:**
- Authentication attempts (without passwords)
- Authorization failures
- Game state changes
- Error stack traces (server-side only)
- Performance metrics

❌ **NEVER log:**
- Passwords
- JWT tokens
- Session IDs
- Credit card numbers
- Personal identifiable information (PII)

### Log Security

- Store logs securely
- Implement log rotation
- Restrict log access
- Monitor for suspicious activity

---

## Dependency Security

### Regular Updates

```bash
# Check for vulnerabilities
npm audit

# Update dependencies
npm update

# Fix vulnerabilities
npm audit fix
```

### Best Practices

- ✅ Review dependencies before adding
- ✅ Keep dependencies updated
- ✅ Monitor security advisories
- ✅ Use lock files (package-lock.json)
- ❌ Don't use unmaintained packages

---

## Incident Response

### If Secrets Are Compromised

1. **Immediately rotate all secrets:**
   ```bash
   # Generate new secrets
   NEW_JWT_SECRET=$(openssl rand -base64 32)
   NEW_DB_PASSWORD=$(openssl rand -base64 32)
   
   # Update .env
   # Restart services
   ```

2. **Revoke all active sessions:**
   - Invalidate all JWT tokens
   - Force users to re-authenticate

3. **Investigate the breach:**
   - Check logs for unauthorized access
   - Identify affected systems
   - Document the incident

4. **Update security measures:**
   - Patch vulnerabilities
   - Improve access controls
   - Review security practices

---

## Security Checklist

### Development

- [ ] `.env` file is gitignored
- [ ] No hard-coded secrets in code
- [ ] Strong random passwords used
- [ ] Input validation implemented
- [ ] Error messages don't leak sensitive info

### Pre-Production

- [ ] All dependencies updated
- [ ] Security audit completed
- [ ] Secrets rotated from development
- [ ] HTTPS configured
- [ ] CORS properly configured

### Production

- [ ] Environment variables set correctly
- [ ] Database backups configured
- [ ] Monitoring and logging enabled
- [ ] Rate limiting implemented
- [ ] Security headers configured
- [ ] Incident response plan documented

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [JWT Best Practices](https://curity.io/resources/learn/jwt-best-practices/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

---

## Contact

For security concerns or to report vulnerabilities, please contact the development team immediately.

**DO NOT** open public GitHub issues for security vulnerabilities.
