# 🏦 Bank Inventory System — Docker Deployment Guide

## 📁 Project Structure

```
bank-inventory/
├── Dockerfile                  # Multi-stage build (Node → Nginx)
├── docker-compose.yml          # Development / simple deployment
├── docker-compose.prod.yml     # Production with reverse proxy
├── .dockerignore               # Files excluded from Docker build
├── .env.example                # Environment variable template
├── package.json                # React app dependencies
├── nginx/
│   └── nginx.conf              # Nginx config for React SPA
└── src/
    └── App.jsx                 # ← Place bank-inventory-system.jsx here
```

---

## 🚀 Quick Start (3 Steps)

### Step 1 — Set up your files

```bash
# Create the project folder
mkdir bank-inventory && cd bank-inventory

# Copy all Docker config files into this folder
# Then create the React source directory
mkdir -p src public

# Place your JSX file
cp bank-inventory-system.jsx src/App.jsx

# Create a minimal public/index.html
cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bank Inventory System</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
EOF

# Copy environment file
cp .env.example .env
```

### Step 2 — Build the Docker image

```bash
docker compose build
```

### Step 3 — Run the container

```bash
docker compose up -d
```

✅ App is now running at: **http://your-server-ip:80**

---

## 🔧 Common Commands

| Action | Command |
|---|---|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| Restart | `docker compose restart` |
| View logs | `docker compose logs -f` |
| Rebuild after code change | `docker compose up -d --build` |
| Check container status | `docker ps` |
| Enter container shell | `docker exec -it bank-inventory-app sh` |

---

## 🌐 Changing the Port

Edit `.env`:
```env
APP_PORT=8080
```
Then restart:
```bash
docker compose down && docker compose up -d
```

---

## 🔒 HTTPS / SSL Setup

### Option A — Using a reverse proxy (recommended for production)

Install Nginx on the host:
```bash
sudo apt install nginx certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com
```

Create `/etc/nginx/sites-available/bank-inventory`:
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/bank-inventory /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 🖥️ Server Requirements

| Component | Minimum |
|---|---|
| OS | Ubuntu 20.04+ / CentOS 7+ / Debian 11+ |
| RAM | 512 MB |
| Disk | 1 GB |
| Docker | 24.x+ |
| Docker Compose | v2.x+ |

### Install Docker on Ubuntu:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

---

## 🔄 Auto-restart on Server Reboot

The `restart: unless-stopped` policy in `docker-compose.yml` ensures the container auto-starts on reboot. To also start Docker itself on boot:

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

---

## 📊 Monitoring

```bash
# Real-time resource usage
docker stats bank-inventory-app

# Container logs
docker logs bank-inventory-app --tail 100 -f

# Health check status
docker inspect --format='{{.State.Health.Status}}' bank-inventory-app
```

---

## 🛠️ Troubleshooting

**Container won't start:**
```bash
docker compose logs bank-inventory
```

**Port already in use:**
```bash
# Find what's using port 80
sudo lsof -i :80
# Change APP_PORT in .env to another port (e.g., 8080)
```

**Build fails (npm errors):**
```bash
# Clear Docker build cache
docker compose build --no-cache
```

---

## 👤 Demo Login Credentials

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| IT Division | `itdiv` | `bank2024` |

Domain format: `BANKNET\username`
