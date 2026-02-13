#!/bin/bash
# ==============================================
# PicShare 远程部署脚本
# 从本地/CI 推送到远程 ECS
# ==============================================

set -e

# Load environment variables from .env.deploy if exists
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env.deploy" ]; then
  echo "📋 加载配置文件: .env.deploy"
  set -a
  source "$SCRIPT_DIR/.env.deploy"
  set +a
fi

# Configuration - set these or pass as env vars
ECS_HOST="${ECS_HOST:?请设置 ECS_HOST 环境变量}"
ECS_USER="${ECS_USER:-root}"
ECS_KEY="${ECS_KEY:-}"  # SSH key path (optional)
ECS_PASSWORD="${ECS_PASSWORD:-}"  # SSH password (optional)
ECS_PORT="${ECS_PORT:-22}"

echo "📸 PicShare - 远程部署"
echo "====================="
echo "目标: ${ECS_USER}@${ECS_HOST}:${ECS_PORT}"

# Determine SSH/SCP command prefix
if [ -n "$ECS_KEY" ]; then
  # Use SSH key
  SSH_CMD="ssh"
  SCP_CMD="scp"
  SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${ECS_PORT} -i $ECS_KEY"
  SCP_OPTS="-o StrictHostKeyChecking=no -P ${ECS_PORT} -i $ECS_KEY"
elif [ -n "$ECS_PASSWORD" ] && command -v sshpass &> /dev/null; then
  # Use password with sshpass
  SSH_CMD="sshpass -p '$ECS_PASSWORD' ssh"
  SCP_CMD="sshpass -p '$ECS_PASSWORD' scp"
  SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${ECS_PORT}"
  SCP_OPTS="-o StrictHostKeyChecking=no -P ${ECS_PORT}"
else
  # Default SSH
  SSH_CMD="ssh"
  SCP_CMD="scp"
  SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${ECS_PORT}"
  SCP_OPTS="-o StrictHostKeyChecking=no -P ${ECS_PORT}"
fi

# Step 1: Build frontend
echo ""
echo "📦 构建前端..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/frontend"
npm install --silent
npm run build

# Step 2: Package application
echo ""
echo "📦 打包应用..."
cd "$SCRIPT_DIR"
rm -f /tmp/picshare-deploy.tar.gz
tar -czf /tmp/picshare-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.md' \
  --exclude='*.png' \
  backend/ \
  frontend/dist/ \
  deploy.sh

echo "打包大小: $(du -h /tmp/picshare-deploy.tar.gz | cut -f1)"

# Step 3: Upload to server
echo ""
echo "⬆️  上传到服务器..."
eval $SCP_CMD $SCP_OPTS /tmp/picshare-deploy.tar.gz ${ECS_USER}@${ECS_HOST}:/tmp/

# Step 4: Run deployment on server
echo ""
echo "🚀 执行部署..."
# Prepare environment variables to pass to remote script
ENV_VARS=""
[ -n "$DB_HOST" ] && ENV_VARS="$ENV_VARS DB_HOST='$DB_HOST'"
[ -n "$DB_PORT" ] && ENV_VARS="$ENV_VARS DB_PORT='$DB_PORT'"
[ -n "$DB_NAME" ] && ENV_VARS="$ENV_VARS DB_NAME='$DB_NAME'"
[ -n "$DB_USER" ] && ENV_VARS="$ENV_VARS DB_USER='$DB_USER'"
[ -n "$DB_PASSWORD" ] && ENV_VARS="$ENV_VARS DB_PASSWORD='$DB_PASSWORD'"
[ -n "$ALIYUN_AK" ] && ENV_VARS="$ENV_VARS ALIYUN_AK='$ALIYUN_AK'"
[ -n "$ALIYUN_SK" ] && ENV_VARS="$ENV_VARS ALIYUN_SK='$ALIYUN_SK'"
[ -n "$OSS_BUCKET" ] && ENV_VARS="$ENV_VARS OSS_BUCKET='$OSS_BUCKET'"
[ -n "$OSS_REGION" ] && ENV_VARS="$ENV_VARS OSS_REGION='$OSS_REGION'"
[ -n "$DOMAIN" ] && ENV_VARS="$ENV_VARS DOMAIN='$DOMAIN'"
[ -n "$ADMIN_EMAIL" ] && ENV_VARS="$ENV_VARS ADMIN_EMAIL='$ADMIN_EMAIL'"
[ -n "$ADMIN_PASSWORD" ] && ENV_VARS="$ENV_VARS ADMIN_PASSWORD='$ADMIN_PASSWORD'"

eval $SSH_CMD $SSH_OPTS ${ECS_USER}@${ECS_HOST} << REMOTE_SCRIPT
  set -e
  
  # Set environment variables
  $ENV_VARS
  
  # Extract
  rm -rf /tmp/picshare
  mkdir -p /tmp/picshare
  tar -xzf /tmp/picshare-deploy.tar.gz -C /tmp/picshare
  
  # Run deploy script with environment variables
  cd /tmp/picshare
  chmod +x deploy.sh
  export $ENV_VARS
  bash deploy.sh
  
  # Cleanup
  rm -f /tmp/picshare-deploy.tar.gz
  rm -rf /tmp/picshare
  
  echo ""
  echo "✅ 远程部署完成！"
REMOTE_SCRIPT

echo ""
echo "🎉 部署成功！"
if [ -n "$DOMAIN" ]; then
  echo "   访问: http://${DOMAIN}"
  echo "   (配置 SSL 后可使用: https://${DOMAIN})"
else
  echo "   访问: http://${ECS_HOST}"
fi
echo ""
echo "📋 后续步骤:"
echo "   1. 配置 SSL 证书: sudo certbot --nginx -d ${DOMAIN:-${ECS_HOST}}"
echo "   2. 查看服务状态: ssh ${ECS_USER}@${ECS_HOST} 'systemctl status picshare'"
echo "   3. 查看日志: ssh ${ECS_USER}@${ECS_HOST} 'tail -f /var/log/picshare/app.log'"
