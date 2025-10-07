# SSL Certificates

Place your TLS certificate files in this directory before starting nginx.

Required filenames:
- `fullchain.pem` – certificate chain returned to clients.
- `privkey.pem` – private key for the certificate.

If you are using Cloudflare, download a Cloudflare origin certificate and key and drop them here. For Let's Encrypt, point Certbot to write into this directory or copy the issued pair.

The docker-compose configuration mounts this directory at `/etc/nginx/ssl` inside the nginx container.
