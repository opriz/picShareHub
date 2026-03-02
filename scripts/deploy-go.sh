#!/bin/bash
# ==============================================
# PicShare Go 版本一键部署脚本
# 部署到阿里云 ECS (Ubuntu/CentOS)
# ==============================================

set -e

echo "╔══════════════════════════════════════╗"
echo "║     📸 PicShare Go 部署脚本       ║"
echo "╚══════════════════════════════════════╝"

# ---- Configuration ----
# These should be set as environment variables or in .env
APP_DIR="/opt/picshare"
APP_USER="picshare"
DOMAIN="${DOMAIN:-www.picshare.com.cn}"
DB_NAME="${DB_NAME:-picshare}"
DB_USER="${DB_USER:-picshare}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 16)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 32)}"

echo ""
echo "🧪 Step 1: System setup..."
echo "========================================"

# Detect OS
if [ -f /etc/debian_version ]; then
  OS="debian"
  echo "Detected: Debian/Ubuntu"
elif [ -f /etc/redhat-release ]; then
  OS="redhat"
  echo "Detected: CentOS/RHEL"
else
  echo "Unsupported OS"
  exit 1
fi

# Update system
if [ "$OS" = "debian" ]; then
  apt-get update -qq
  apt-get install -y -qq curl git nginx postgresql-client
elif [ "$OS" = "redhat" ]; then
  yum update -y -q
  yum install -y -q curl git nginx postgresql
fi

echo ""
echo "🧪 Step 2: Create app user and directories..."
echo "========================================"

# Create app user
id -u $APP_USER &>/dev/null || useradd -r -m -s /bin/bash $APP_USER

# Create app directory
mkdir -p $APP_DIR
mkdir -p /var/log/picshare

echo ""
echo "📦 Step 3: Deploy application..."
echo "======================================"

# Copy binary
if [ -f /tmp/picshare/picshare-server ]; then
  cp /tmp/picshare/picshare-server $APP_DIR/
  chmod +x $APP_DIR/picshare-server
elif [ -f "$(dirname "$0")/backend-go/picshare-server" ]; then
  cp "$(dirname "$0")/backend-go/picshare-server" $APP_DIR/
  chmod +x $APP_DIR/picshare-server
else
  echo "错误: 找不到 picshare-server 二进制文件"
  exit 1
fi

# Copy frontend build to public directory
mkdir -p $APP_DIR/public
if [ -d /tmp/picshare/frontend/dist ]; then
  cp -r /tmp/picshare/frontend/dist/* $APP_DIR/public/ 2>/dev/null || true
elif [ -d "$(dirname "$0")/frontend/dist" ]; then
  cp -r "$(dirname "$0")/frontend/dist/"* $APP_DIR/public/ 2>/dev/null || true
fi

# Set ownership
chown -R $APP_USER:$APP_USER $APP_DIR
chown -R $APP_USER:$APP_USER /var/log/picshare

echo ""
echo "⚙️  Step 4: Configure environment..."
echo "========================================"

# Create .env file
cat > $APP_DIR/.env << EOF
# Server
PORT=3000
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}

# Database (PostgreSQL)
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# OSS
OSS_REGION=${OSS_REGION:-oss-cn-hangzhou}
OSS_ENDPOINT=${OSS_ENDPOINT:-oss-cn-hangzhou.aliyuncs.com}
OSS_BUCKET=${OSS_BUCKET:-picshare-photos}
OSS_ACCESS_KEY_ID=${ALIYUN_AK:-${OSS_ACCESS_KEY_ID:-}}
OSS_ACCESS_KEY_SECRET=${ALIYUN_SK:-${OSS_ACCESS_KEY_SECRET:-}}

# Frontend
FRONTEND_URL=https://${DOMAIN}

# Email (阿里云邮件推送)
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-465}
SMTP_USER=${SMTP_USER:-}
SMTP_PASS=${SMTP_PASS:-}
SMTP_FROM=${SMTP_FROM:-PicShare <noreply@${DOMAIN:-picshare.com.cn}>}

# Admin
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@picshare.com.cn}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-Admin123456!}
EOF

chown $APP_USER:$APP_USER $APP_DIR/.env
chmod 600 $APP_DIR/.env

echo ""
echo "🗄️  Step 5: Initialize database..."
echo "========================================"

# Note: For Go backend, DB initialization is done on first run
# We don't need npm install anymore

echo ""
echo "🔄 Step 6: Setup systemd service..."
echo "========================================"

cat > /etc/systemd/system/picshare.service << EOF
[Unit]
Description=PicShare Go Backend Server
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/picshare-server
EnvironmentFile=$APP_DIR/.env
Restart=always
RestartSec=5
StandardOutput=append:/var/log/picshare/app.log
StandardError=append:/var/log/picshare/error.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable picshare
systemctl restart picshare

echo ""
echo "🌐 Step 7: Configure Nginx..."
echo "======================================"

cat > /etc/nginx/sites-available/picshare << 'NGINX'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    client_max_body_size 100M;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    # Frontend static files
    location / {
        root $APP_DIR/public;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
NGINX

# Replace domain placeholder
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" /etc/nginx/sites-available/picshare
sed -i "s|\$APP_DIR|${APP_DIR}|g" /etc/nginx/sites-available/picshare

# Enable site
ln -sf /etc/nginx/sites-available/picshare /etc/nginx/sites-enabled/picshare
rm -f /etc/nginx/sites-enabled/default

# Test and restart nginx
nginx -t && systemctl restart nginx

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅ 部署完成！                       ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "📍 访问地址: http://${DOMAIN}"
echo "📍 API 地址: http://${DOMAIN}/api/health"
echo ""
echo "📋 管理员账号:"
echo "   邮箱: ${ADMIN_EMAIL:-admin@picshare.com.cn}"
echo "   密码: ${ADMIN_PASSWORD:-Admin123456!}"
echo ""
echo "🔧 常用命令:"
echo "   查看状态: systemctl status picshare"
echo "   查看日志: journalctl -u picshare -f"
echo "   重启服务: systemctl restart picshare"
echo ""
echo "💡 后续步骤:"
echo "   1. 配置 SSL 证书 (certbot --nginx -d ${DOMAIN})"
echo "   2. 配置防火墙 (开放 80/443 端口)"
echo "   3. 配置数据库白名单"
echo ""
