#!/bin/bash
# ==============================================
# PicShare 一键部署脚本 (支持负载均衡)
# 部署到阿里云 ECS + SLB
# ==============================================

set -e

echo "╔══════════════════════════════════════╗"
echo "║  📸 PicShare 部署脚本 (LB 模式)      ║"
echo "╚══════════════════════════════════════╝"

# ---- Configuration ----
APP_DIR="/opt/picshare"
APP_USER="picshare"
DOMAIN="${DOMAIN:-www.picshare.com.cn}"
DB_NAME="${DB_NAME:-picshare}"
DB_USER="${DB_USER:-picshare}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 16)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 32)}"

# 负载均衡模式标识
USE_LB="${USE_LB:-true}"

echo ""
echo "🔧 Step 1: System setup..."
echo "=========================="

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

# Install Node.js 22 if not present
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  echo "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"

echo ""
echo "🔧 Step 2: Create app user and directories..."
echo "==============================================="

# Create app user
id -u $APP_USER &>/dev/null || useradd -r -m -s /bin/bash $APP_USER

# Create app directory
mkdir -p $APP_DIR
mkdir -p /var/log/picshare

echo ""
echo "📦 Step 3: Deploy application..."
echo "================================="

# Copy application files
cp -r /tmp/picshare/backend/* $APP_DIR/ 2>/dev/null || {
  if [ -d "$(dirname "$0")/backend" ]; then
    cp -r "$(dirname "$0")/backend/"* $APP_DIR/
  fi
}

# Copy frontend build
mkdir -p $APP_DIR/public
cp -r /tmp/picshare/frontend/dist/* $APP_DIR/public/ 2>/dev/null || {
  if [ -d "$(dirname "$0")/frontend/dist" ]; then
    cp -r "$(dirname "$0")/frontend/dist/"* $APP_DIR/public/
  fi
}

# Install dependencies
cd $APP_DIR
npm install --production

# Set ownership
chown -R $APP_USER:$APP_USER $APP_DIR
chown -R $APP_USER:$APP_USER /var/log/picshare

echo ""
echo "⚙️  Step 4: Configure environment..."
echo "====================================="

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
echo "===================================="

cd $APP_DIR
su -c "node src/scripts/initDb.js" $APP_USER || echo "⚠️ DB init skipped (configure DB_HOST first)"
su -c "node src/scripts/seedAdmin.js" $APP_USER || echo "⚠️ Admin seed skipped"

echo ""
echo "🔄 Step 6: Setup systemd service..."
echo "===================================="

cat > /etc/systemd/system/picshare.service << EOF
[Unit]
Description=PicShare Backend Server
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node src/app.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/picshare/app.log
StandardError=append:/var/log/picshare/error.log
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable picshare
systemctl restart picshare

echo ""
echo "🌐 Step 7: Configure Nginx (LB Mode)..."
echo "========================================="

# Nginx 配置 - 适配负载均衡
cat > /etc/nginx/sites-available/picshare << 'NGINX'
# 获取真实客户端 IP (从负载均衡传递)
map $http_x_forwarded_for $real_ip {
    ~^(\d+\.\d+\.\d+\.\d+) $1;
    default $remote_addr;
}

server {
    listen 80;
    server_name _;

    client_max_body_size 100M;

    # 获取真实 IP 地址
    set_real_ip_from 0.0.0.0/0;
    real_ip_header X-Forwarded-For;
    real_ip_recursive on;

    # 健康检查端点 (供负载均衡使用)
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    # Frontend static files
    location / {
        root /opt/picshare/public;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
NGINX

# Enable site
ln -sf /etc/nginx/sites-available/picshare /etc/nginx/sites-enabled/picshare
rm -f /etc/nginx/sites-enabled/default

# Test and restart nginx
nginx -t && systemctl restart nginx

echo ""
echo "📋 Step 8: Setup cron job for cleanup..."
echo "=========================================="

# Cleanup expired albums every hour
(crontab -u $APP_USER -l 2>/dev/null; echo "0 * * * * cd $APP_DIR && node src/scripts/cleanupExpired.js >> /var/log/picshare/cleanup.log 2>&1") | sort -u | crontab -u $APP_USER -

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅ 部署完成！(负载均衡模式)         ║"
echo "╚══════════════════════════════════════╝"
echo ""

if [ "$USE_LB" = "true" ]; then
  echo "📍 访问方式:"
  echo "   • 通过负载均衡: http://${LB_ADDRESS:-负载均衡地址}"
  echo "   • 通过域名: http://${DOMAIN}"
  echo "   • 健康检查: http://${LB_ADDRESS:-负载均衡地址}/health"
else
  echo "📍 访问地址: http://${DOMAIN}"
fi

echo ""
echo "📋 管理员账号:"
echo "   邮箱: ${ADMIN_EMAIL:-admin@picshare.com.cn}"
echo "   密码: ${ADMIN_PASSWORD:-Admin123456!}"
echo ""
echo "🔧 常用命令:"
echo "   查看状态: systemctl status picshare"
echo "   查看日志: tail -f /var/log/picshare/app.log"
echo "   重启服务: systemctl restart picshare"
echo "   查看 Nginx: systemctl status nginx"
echo ""
echo "💡 负载均衡配置:"
echo "   • 后端服务器: 本机 (端口 80)"
echo "   • 健康检查: GET /health"
echo "   • 真实 IP 传递: X-Forwarded-For"
echo ""
echo "💡 后续步骤:"
echo "   1. 配置负载均衡 HTTPS 监听 (443 端口)"
echo "   2. 上传 SSL 证书到负载均衡"
echo "   3. 配置域名 DNS 解析到负载均衡地址"
echo "   4. 配置防火墙 (ECS 只允许 LB 访问)"
echo ""
