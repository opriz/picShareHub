#!/bin/bash

# 一键部署脚本 - 照片共享服务
# 使用方法: 
#   1. 编辑此文件，填入你的 AccessKey 信息
#   2. chmod +x one-click-deploy.sh
#   3. ./one-click-deploy.sh

set -e

echo "================================"
echo "照片共享服务 - 一键部署"
echo "================================"
echo ""

# ========================================
# 配置区域 - 请填入你的信息
# ========================================

# 阿里云凭证（从 Cursor Dashboard 获取）
ACCESS_KEY_ID="${ALIYUN_AK:-YOUR_ACCESS_KEY_ID}"
ACCESS_KEY_SECRET="${ALIYUN_SK:-YOUR_ACCESS_KEY_SECRET}"

# OSS 配置
OSS_REGION="cn-hangzhou"
OSS_BUCKET="${OSS_BUCKET:-photo-share-hub-$(date +%Y%m%d)}"

# CDN 域名（可选）
CDN_DOMAIN="${CDN_DOMAIN:-}"

# ========================================
# 以下代码无需修改
# ========================================

# 检查凭证
if [ "$ACCESS_KEY_ID" = "YOUR_ACCESS_KEY_ID" ] || [ -z "$ACCESS_KEY_ID" ]; then
    echo "❌ 错误: 请先配置 ACCESS_KEY_ID"
    echo ""
    echo "请编辑此脚本，将 YOUR_ACCESS_KEY_ID 替换为你的阿里云 AccessKey ID"
    echo "或者设置环境变量: export ALIYUN_AK=your_key_id"
    echo ""
    exit 1
fi

if [ "$ACCESS_KEY_SECRET" = "YOUR_ACCESS_KEY_SECRET" ] || [ -z "$ACCESS_KEY_SECRET" ]; then
    echo "❌ 错误: 请先配置 ACCESS_KEY_SECRET"
    echo ""
    echo "请编辑此脚本，将 YOUR_ACCESS_KEY_SECRET 替换为你的阿里云 AccessKey Secret"
    echo "或者设置环境变量: export ALIYUN_SK=your_secret"
    echo ""
    exit 1
fi

echo "✓ 凭证检查通过"
echo ""

# 配置 ossutil
echo "📝 步骤 1/6: 配置 ossutil..."
ossutil config -e oss-${OSS_REGION}.aliyuncs.com \
  -i "$ACCESS_KEY_ID" \
  -k "$ACCESS_KEY_SECRET" \
  -L CH

if [ $? -eq 0 ]; then
    echo "✓ ossutil 配置成功"
else
    echo "❌ ossutil 配置失败"
    exit 1
fi

# 检查 Bucket 是否存在
echo ""
echo "📦 步骤 2/6: 检查 OSS Bucket..."
ossutil ls oss://${OSS_BUCKET}/ > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Bucket 已存在: $OSS_BUCKET"
else
    echo "⚠️  Bucket 不存在: $OSS_BUCKET"
    echo "请手动在阿里云控制台创建 Bucket:"
    echo "  1. 访问: https://oss.console.aliyun.com/"
    echo "  2. 创建 Bucket，名称: $OSS_BUCKET"
    echo "  3. 区域: 华东1（杭州）"
    echo "  4. 读写权限: 公共读"
    echo "  5. 配置静态网站托管，首页和404页都设为 index.html"
    echo ""
    read -p "创建完成后按回车继续..."
fi

# 构建项目（如果需要）
echo ""
echo "🔨 步骤 3/6: 检查构建文件..."
if [ ! -d "/workspace/frontend/dist" ]; then
    echo "构建文件不存在，开始构建项目..."
    cd /workspace/frontend
    npm run build
else
    echo "✓ 构建文件已存在"
fi

# 上传文件到 OSS
echo ""
echo "⬆️  步骤 4/6: 上传文件到 OSS..."
cd /workspace/frontend
ossutil cp -r -f dist/ oss://${OSS_BUCKET}/

if [ $? -eq 0 ]; then
    echo "✓ 文件上传成功"
else
    echo "❌ 文件上传失败"
    exit 1
fi

# 设置文件类型
echo ""
echo "📝 步骤 5/6: 设置文件类型..."
ossutil set-meta oss://${OSS_BUCKET}/ Content-Type:text/html --include "*.html" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Content-Type:text/css --include "*.css" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Content-Type:application/javascript --include "*.js" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Content-Type:image/svg+xml --include "*.svg" -r -f

echo "✓ 文件类型设置完成"

# 设置缓存策略
echo ""
echo "⚡ 步骤 6/6: 设置缓存策略..."
ossutil set-meta oss://${OSS_BUCKET}/ Cache-Control:no-cache --include "*.html" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Cache-Control:max-age=31536000 --include "*.js" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Cache-Control:max-age=31536000 --include "*.css" -r -f

echo "✓ 缓存策略设置完成"

# 完成
echo ""
echo "================================"
echo "🎉 部署完成！"
echo "================================"
echo ""
echo "📍 访问地址:"
echo "   OSS 直连: http://${OSS_BUCKET}.oss-${OSS_REGION}.aliyuncs.com/index.html"
echo ""

if [ -n "$CDN_DOMAIN" ]; then
    echo "   CDN 加速: https://${CDN_DOMAIN}"
    echo ""
    echo "⚠️  如果使用CDN，请记得刷新CDN缓存:"
    echo "   访问 https://cdn.console.aliyun.com/ 刷新整个目录"
    echo ""
fi

echo "💡 提示:"
echo "   - OSS控制台: https://oss.console.aliyun.com/"
echo "   - 查看部署详情: cat /workspace/QUICK_DEPLOY_GUIDE.md"
echo "   - 查看完整文档: cat /workspace/frontend/DEPLOYMENT.md"
echo ""
echo "🌟 享受你的照片共享服务吧！"
echo ""
