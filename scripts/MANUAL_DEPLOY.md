# 📖 手动部署指南

基于现有脚本的手动部署步骤说明，适合需要更多控制或调试的场景。

## 📋 前置准备

### 1. 准备配置文件

复制并编辑 `.env.deploy` 文件：

```bash
cp .env.deploy.example .env.deploy
# 编辑 .env.deploy，填入你的配置信息
```

关键配置项：
- `ECS_HOST`: ECS 公网 IP
- `ECS_USER`: SSH 用户名（通常是 root）
- `ECS_PASSWORD`: SSH 密码（或使用 `ECS_KEY` 指定密钥路径）
- `DB_HOST`: RDS 数据库地址（内网或公网）
- `DB_PASSWORD`: 数据库密码
- `ALIYUN_AK` / `ALIYUN_SK`: 阿里云 AccessKey
- `OSS_BUCKET`: OSS Bucket 名称

### 2. 检查本地环境

确保已安装：
- Node.js 18+
- npm
- SSH 客户端
- `sshpass`（如果使用密码认证）：`brew install sshpass` (macOS) 或 `apt-get install sshpass` (Linux)

## 🚀 手动部署步骤

### 步骤 1: 加载环境变量

```bash
# 在项目根目录
source .env.deploy

# 验证关键变量
echo "ECS: ${ECS_HOST}"
echo "DB: ${DB_HOST}"
```

### 步骤 2: 构建前端

```bash
cd frontend
npm install
npm run build
cd ..
```

**说明**: 这会生成 `frontend/dist/` 目录，包含编译后的前端静态文件。

### 步骤 3: 打包应用

```bash
# 创建临时打包目录
rm -rf /tmp/picshare-deploy
mkdir -p /tmp/picshare-deploy

# 复制后端代码
cp -r backend /tmp/picshare-deploy/

# 复制前端构建产物
cp -r frontend/dist /tmp/picshare-deploy/frontend-dist

# 复制部署脚本
cp deploy.sh /tmp/picshare-deploy/

# 打包
cd /tmp
tar -czf picshare-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  picshare-deploy/

# 返回项目目录
cd /path/to/picShareHub
```

**说明**: 打包时会排除 `node_modules`（服务器上会重新安装）和 `.git` 目录。

### 步骤 4: 上传到服务器

#### 方式 A: 使用密码（需要 sshpass）

```bash
sshpass -p "${ECS_PASSWORD}" scp \
  -o StrictHostKeyChecking=no \
  /tmp/picshare-deploy.tar.gz \
  ${ECS_USER}@${ECS_HOST}:/tmp/
```

#### 方式 B: 使用 SSH 密钥

```bash
scp -i ${ECS_KEY} \
  -o StrictHostKeyChecking=no \
  /tmp/picshare-deploy.tar.gz \
  ${ECS_USER}@${ECS_HOST}:/tmp/
```

#### 方式 C: 手动上传

如果自动上传失败，可以：
1. 使用 SFTP 客户端（如 FileZilla）
2. 或使用 `rsync`、`sftp` 等工具

### 步骤 5: 连接到服务器

```bash
# 使用密码
sshpass -p "${ECS_PASSWORD}" ssh \
  -o StrictHostKeyChecking=no \
  ${ECS_USER}@${ECS_HOST}

# 或使用密钥
ssh -i ${ECS_KEY} ${ECS_USER}@${ECS_HOST}
```

### 步骤 6: 在服务器上解压

```bash
# 创建临时目录
rm -rf /tmp/picshare
mkdir -p /tmp/picshare

# 解压
tar -xzf /tmp/picshare-deploy.tar.gz -C /tmp/picshare

# 进入目录
cd /tmp/picshare/picshare-deploy
```

### 步骤 7: 设置环境变量（在服务器上）

```bash
# 设置数据库配置
export DB_HOST="你的数据库地址"
export DB_PORT="5432"
export DB_NAME="picshare"
export DB_USER="picshare"
export DB_PASSWORD="你的数据库密码"

# 设置 OSS 配置
export ALIYUN_AK="你的AccessKeyId"
export ALIYUN_SK="你的AccessKeySecret"
export OSS_BUCKET="你的Bucket名称"
export OSS_REGION="oss-cn-hangzhou"

# 设置域名（可选）
export DOMAIN="你的域名或IP"

# 设置管理员（可选）
export ADMIN_EMAIL="admin@picshare.com.cn"
export ADMIN_PASSWORD="Admin123456!"

# 设置 JWT Secret（可选，会自动生成）
export JWT_SECRET="$(openssl rand -base64 32)"
```

### 步骤 8: 执行部署脚本（在服务器上）

```bash
# 确保脚本有执行权限
chmod +x deploy.sh

# 执行部署
bash deploy.sh
```

**说明**: `deploy.sh` 会自动完成以下操作：
1. 安装系统依赖（Node.js、Nginx、PostgreSQL 客户端等）
2. 创建应用用户和目录
3. 复制应用文件到 `/opt/picshare`
4. 安装 Node.js 依赖
5. 创建 `.env` 配置文件
6. 初始化数据库
7. 创建管理员账号
8. 配置 systemd 服务
9. 配置 Nginx
10. 设置定时任务

### 步骤 9: 验证部署

```bash
# 检查服务状态
systemctl status picshare
systemctl status nginx

# 查看日志
tail -f /var/log/picshare/app.log

# 测试 API
curl http://localhost/api/health

# 测试前端
curl http://localhost/
```

### 步骤 10: 清理临时文件（可选）

```bash
# 在服务器上
rm -f /tmp/picshare-deploy.tar.gz
rm -rf /tmp/picshare

# 在本地
rm -rf /tmp/picshare-deploy
rm -f /tmp/picshare-deploy.tar.gz
```

## 🔧 分步骤手动执行（高级）

如果你想完全手动控制每个步骤，可以按照 `deploy.sh` 的逻辑逐步执行：

### 1. 系统准备

```bash
# 更新系统
apt-get update -qq
apt-get install -y -qq curl git nginx postgresql-client

# 安装 Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# 验证安装
node -v
npm -v
```

### 2. 创建应用用户和目录

```bash
APP_DIR="/opt/picshare"
APP_USER="picshare"

# 创建用户
id -u $APP_USER &>/dev/null || useradd -r -m -s /bin/bash $APP_USER

# 创建目录
mkdir -p $APP_DIR
mkdir -p /var/log/picshare
```

### 3. 部署应用文件

```bash
# 复制后端代码
cp -r /tmp/picshare/picshare-deploy/backend/* $APP_DIR/

# 复制前端构建产物
mkdir -p $APP_DIR/public
cp -r /tmp/picshare/picshare-deploy/frontend-dist/* $APP_DIR/public/

# 安装依赖
cd $APP_DIR
npm install --production

# 设置权限
chown -R $APP_USER:$APP_USER $APP_DIR
chown -R $APP_USER:$APP_USER /var/log/picshare
```

### 4. 创建配置文件

```bash
cat > $APP_DIR/.env << EOF
# Server
PORT=3000
NODE_ENV=production
JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 32)}

# Database
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-picshare}
DB_USER=${DB_USER:-picshare}
DB_PASSWORD=${DB_PASSWORD}

# OSS
OSS_REGION=${OSS_REGION:-oss-cn-hangzhou}
OSS_ENDPOINT=${OSS_ENDPOINT:-oss-cn-hangzhou.aliyuncs.com}
OSS_BUCKET=${OSS_BUCKET}
OSS_ACCESS_KEY_ID=${ALIYUN_AK}
OSS_ACCESS_KEY_SECRET=${ALIYUN_SK}

# Frontend
FRONTEND_URL=http://${DOMAIN:-${ECS_HOST}}

# Email
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-465}
SMTP_USER=${SMTP_USER:-}
SMTP_PASS=${SMTP_PASS:-}
SMTP_FROM=${SMTP_FROM:-PicShare <noreply@picshare.com.cn>}

# Admin
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@picshare.com.cn}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-Admin123456!}
EOF

chown $APP_USER:$APP_USER $APP_DIR/.env
chmod 600 $APP_DIR/.env
```

### 5. 初始化数据库

```bash
cd $APP_DIR
su -c "node src/scripts/initDb.js" $APP_USER
su -c "node src/scripts/seedAdmin.js" $APP_USER
```

### 6. 配置 systemd 服务

```bash
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
systemctl start picshare
```

### 7. 配置 Nginx

```bash
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
        root /opt/picshare/public;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
NGINX

# 替换域名占位符
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN:-${ECS_HOST}}/g" /etc/nginx/sites-available/picshare

# 启用站点
ln -sf /etc/nginx/sites-available/picshare /etc/nginx/sites-enabled/picshare
rm -f /etc/nginx/sites-enabled/default

# 测试并重启
nginx -t && systemctl restart nginx
```

### 8. 配置定时任务

```bash
# 清理过期相册（每小时执行）
(crontab -u $APP_USER -l 2>/dev/null; \
 echo "0 * * * * cd $APP_DIR && node src/scripts/cleanupExpired.js >> /var/log/picshare/cleanup.log 2>&1") \
 | sort -u | crontab -u $APP_USER -
```

## 🔍 故障排查

### 问题 1: 上传失败

**症状**: `scp` 命令失败

**解决方案**:
- 检查 SSH 连接：`ssh ${ECS_USER}@${ECS_HOST}`
- 检查防火墙和安全组设置
- 尝试使用 `rsync` 替代 `scp`

### 问题 2: 部署脚本执行失败

**症状**: `deploy.sh` 报错

**解决方案**:
- 检查环境变量是否正确设置
- 查看详细错误信息
- 手动执行失败的步骤

### 问题 3: 服务无法启动

**症状**: `systemctl status picshare` 显示失败

**解决方案**:
```bash
# 查看详细日志
journalctl -u picshare -n 50

# 检查配置文件
cat /opt/picshare/.env

# 手动测试启动
cd /opt/picshare
sudo -u picshare node src/app.js
```

### 问题 4: 数据库连接失败

**症状**: 数据库初始化或应用启动时连接失败

**解决方案**:
```bash
# 测试数据库连接
export PGPASSWORD="${DB_PASSWORD}"
psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d postgres -c "SELECT version();"

# 检查 RDS 白名单
# 确保 ECS 的内网 IP 或公网 IP 在白名单中
```

### 问题 5: Nginx 502 错误

**症状**: 访问网站显示 502 Bad Gateway

**解决方案**:
```bash
# 检查后端服务是否运行
systemctl status picshare

# 检查端口是否监听
netstat -tlnp | grep 3000

# 测试后端 API
curl http://127.0.0.1:3000/api/health

# 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log
```

## 📝 更新部署

当代码更新后，重新部署：

```bash
# 1. 在本地更新代码
git pull

# 2. 重新构建前端
cd frontend && npm run build && cd ..

# 3. 重新打包和上传（重复步骤 3-4）

# 4. 在服务器上更新
ssh ${ECS_USER}@${ECS_HOST}
cd /opt/picshare
git pull  # 如果使用 git
# 或解压新上传的文件

# 5. 安装新依赖
npm install --production

# 6. 重启服务
systemctl restart picshare
```

## 💡 提示

1. **使用版本控制**: 建议在服务器上使用 git，方便更新和回滚
2. **备份配置**: 部署前备份 `/opt/picshare/.env` 文件
3. **测试环境**: 先在测试环境验证，再部署到生产环境
4. **监控日志**: 部署后持续关注日志，及时发现问题
5. **安全加固**: 部署完成后修改默认密码，配置 SSL 证书

## 📚 相关文档

- [DEPLOY.md](./DEPLOY.md) - 完整部署文档
- [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) - 快速部署指南
- [DEPLOY_SUCCESS.md](./DEPLOY_SUCCESS.md) - 部署成功示例

---

**手动部署的优势**:
- ✅ 完全控制每个步骤
- ✅ 便于调试和排查问题
- ✅ 可以自定义部署流程
- ✅ 适合复杂场景和特殊需求

**手动部署的劣势**:
- ⚠️ 步骤较多，容易出错
- ⚠️ 需要手动处理错误
- ⚠️ 更新时需要重复操作

建议：首次部署使用自动脚本，后续更新可以手动操作。
