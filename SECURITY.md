# Security Guidelines

## ⚠️ Important Security Information

This document outlines security best practices for the Buck Euchre application.

---

## Secrets Management

### ❌ NEVER commit these files to Git:

- `.env`
- `.env.local`
- `.env.production`
- Any file containing passwords, API keys, or secrets

### ✅ Files Safe to Commit:

- `.env.example` - Template with placeholder values only
- Documentation with clearly marked example credentials

---

## Example Credentials in This Repository

The following files contain **EXAMPLE ONLY** credentials that **MUST BE CHANGED**:

### 📄 `env.example`
- Contains placeholder values like `CHANGE_THIS_PASSWORD`
- **Action Required:** Copy to `.env` and replace all values

### 📄 `setup.sh`
- Contains development-only example passwords
- **For local development only**
- Never use these credentials in production

### 📄 Documentation Files
- May contain example credentials in code blocks
- Always clearly marked as examples
- Never use in real deployments

---

## Setting Up Secure Credentials

### 1. Generate Strong Passwords

```bash
# Generate a random password
openssl rand -base64 32

# Or use a password manager
# - 1Password
# - LastPass
# - Bitwarden
```

### 2. Generate JWT Secret

```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Create Your .env File

```bash
# Copy the example file
cp env.example .env

# Edit with your secure values
nano .env  # or your preferred editor
```

### 4. Verify .gitignore

Ensure `.env` is in your `.gitignore`:

```gitignore
# Environment files
.env
.env.local
.env.production
.env.*.local
```

---

## Production Security Checklist

### Before Deploying to Production:

- [ ] All secrets are environment-specific and secure
- [ ] No hard-coded credentials in code
- [ ] `.env` files are not committed to Git
- [ ] JWT_SECRET is cryptographically random (64+ characters)
- [ ] Database passwords are strong (20+ characters)
- [ ] CORS origins are restricted to your domain
- [ ] Rate limiting is enabled
- [ ] HTTPS/TLS is configured
- [ ] Database connections use SSL
- [ ] Security headers are configured
- [ ] Dependencies are up to date (run `npm audit`)

### Environment Variables Requiring Strong Secrets:

```bash
# Database
DB_PASSWORD=<strong-random-password>

# JWT Authentication  
JWT_SECRET=<64-character-random-hex>

# Production URLs (no localhost!)
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://api.your-domain.com
```

---

## Development vs Production

### Development (Local)
- ✅ Simple passwords OK for local database
- ✅ Can use example credentials from setup.sh
- ✅ Localhost URLs acceptable
- ⚠️ Still add .env to .gitignore

### Production
- ❌ Never use default/example credentials
- ❌ Never use weak passwords
- ❌ Never hardcode secrets
- ✅ Use secrets management service
- ✅ Rotate secrets regularly
- ✅ Use strong authentication

---

## Secrets Management Services

For production deployments, use a secrets management service:

### Cloud Providers:
- **AWS:** AWS Secrets Manager, Parameter Store
- **Google Cloud:** Secret Manager
- **Azure:** Key Vault
- **Heroku:** Config Vars
- **Vercel:** Environment Variables (encrypted)

### Self-Hosted:
- **HashiCorp Vault**
- **Docker Secrets**
- **Kubernetes Secrets**

---

## Environment Variables Reference

### Required Secrets:

| Variable | Description | Security Level | Example |
|----------|-------------|----------------|---------|
| `DB_PASSWORD` | PostgreSQL password | 🔴 Critical | `<random-32-chars>` |
| `JWT_SECRET` | JWT signing key | 🔴 Critical | `<random-64-hex>` |

### Configuration (Non-Secret):

| Variable | Description | Security Level | Example |
|----------|-------------|----------------|---------|
| `DB_HOST` | Database host | 🟡 Moderate | `localhost` |
| `DB_PORT` | Database port | 🟢 Low | `5432` |
| `DB_NAME` | Database name | 🟢 Low | `buckeuchre` |
| `DB_USER` | Database user | 🟡 Moderate | `buckeuchre` |
| `NODE_ENV` | Environment | 🟢 Low | `production` |
| `PORT` | Server port | 🟢 Low | `3000` |

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. Email security concerns to: [your-email@example.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

---

## Security Updates

- Regularly run `npm audit` and fix vulnerabilities
- Keep dependencies up to date
- Review security advisories for used packages
- Test security patches before deploying

```bash
# Check for vulnerabilities
npm audit

# Fix automatically (when possible)
npm audit fix

# Update dependencies
npm update
```

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT Security Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Remember: Security is not a one-time task. Regularly review and update security practices.**
