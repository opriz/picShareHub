#!/bin/bash
# ==============================================
# PicShare 远程部署脚本
# 从本地/CI 推送到远程 ECS
# ==============================================

set -e

# Configuration - set these or pass as env vars
ECS_HOST="${ECS_HOST:?请设置 ECS_HOST 环境变量}"
ECS_USER="${ECS_USER:-root}"
ECS_KEY="${ECS_KEY:-}"  # SSH key path (optional)
ECS_PORT="${ECS_PORT:-22}"

echo "📸 PicShare - 远程部署"
echo "====================="
echo "目标: ${ECS_USER}@${ECS_HOST}:${ECS_PORT}"

SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${ECS_PORT}"
if [ -n "$ECS_KEY" ]; then
  SSH_OPTS="$SSH_OPTS -i $ECS_KEY"
fi

SCP_OPTS="-o StrictHostKeyChecking=no -P ${ECS_PORT}"
if [ -n "$ECS_KEY" ]; then
  SCP_OPTS="$SCP_OPTS -i $ECS_KEY"
fi

# Step 1: Build frontend
echo ""
echo "📦 构建前端..."
cd "$(dirname "$0")/frontend"
npm install --silent
npm run build

# Step 2: Package application
echo ""
echo "📦 打包应用..."
cd "$(dirname "$0")"
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
scp $SCP_OPTS /tmp/picshare-deploy.tar.gz ${ECS_USER}@${ECS_HOST}:/tmp/

# Step 4: Run deployment on server
echo ""
echo "🚀 执行部署..."
ssh $SSH_OPTS ${ECS_USER}@${ECS_HOST} << 'REMOTE_SCRIPT'
  set -e
  
  # Extract
  rm -rf /tmp/picshare
  mkdir -p /tmp/picshare
  tar -xzf /tmp/picshare-deploy.tar.gz -C /tmp/picshare
  
  # Run deploy script
  cd /tmp/picshare
  chmod +x deploy.sh
  bash deploy.sh
  
  # Cleanup
  rm -f /tmp/picshare-deploy.tar.gz
  rm -rf /tmp/picshare
  
  echo ""
  echo "✅ 远程部署完成！"
REMOTE_SCRIPT

echo ""
echo "🎉 部署成功！"
echo "   访问: https://${DOMAIN:-www.picshare.com.cn}"
