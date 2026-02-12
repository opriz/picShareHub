#!/bin/bash

# 照片共享服务前端部署脚本
# 部署到阿里云OSS + CDN

set -e

echo "================================"
echo "照片共享服务前端部署脚本"
echo "================================"

# 配置变量（从环境变量读取）
OSS_BUCKET=${OSS_BUCKET:-""}
OSS_REGION=${OSS_REGION:-"oss-cn-hangzhou"}
OSS_ACCESS_KEY_ID=${OSS_ACCESS_KEY_ID:-""}
OSS_ACCESS_KEY_SECRET=${OSS_ACCESS_KEY_SECRET:-""}
CDN_DOMAIN=${CDN_DOMAIN:-""}

# 检查必需的环境变量
if [ -z "$OSS_BUCKET" ] || [ -z "$OSS_ACCESS_KEY_ID" ] || [ -z "$OSS_ACCESS_KEY_SECRET" ]; then
    echo "错误: 请设置以下环境变量："
    echo "  - OSS_BUCKET"
    echo "  - OSS_ACCESS_KEY_ID"
    echo "  - OSS_ACCESS_KEY_SECRET"
    echo ""
    echo "可选环境变量："
    echo "  - OSS_REGION (默认: oss-cn-hangzhou)"
    echo "  - CDN_DOMAIN (CDN域名)"
    exit 1
fi

# 安装ossutil如果未安装
if ! command -v ossutil &> /dev/null; then
    echo "正在安装 ossutil..."
    wget http://gosspublic.alicdn.com/ossutil/1.7.15/ossutil64 -O /tmp/ossutil64
    chmod +x /tmp/ossutil64
    sudo mv /tmp/ossutil64 /usr/local/bin/ossutil
fi

# 配置ossutil
echo "配置 ossutil..."
ossutil config -e ${OSS_REGION}.aliyuncs.com -i ${OSS_ACCESS_KEY_ID} -k ${OSS_ACCESS_KEY_SECRET} -L CH

# 构建项目
echo ""
echo "1. 构建项目..."
npm install
npm run build

# 检查构建结果
if [ ! -d "dist" ]; then
    echo "错误: 构建失败，dist目录不存在"
    exit 1
fi

echo "构建完成！"

# 上传到OSS
echo ""
echo "2. 上传到 OSS bucket: ${OSS_BUCKET}..."
ossutil cp -r -f dist/ oss://${OSS_BUCKET}/ --include "*"

# 设置文件类型
echo ""
echo "3. 设置文件Content-Type..."
ossutil set-meta oss://${OSS_BUCKET}/ Content-Type:text/html --include "*.html" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Content-Type:text/css --include "*.css" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Content-Type:application/javascript --include "*.js" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Content-Type:image/svg+xml --include "*.svg" -r -f

# 设置缓存策略
echo ""
echo "4. 设置缓存策略..."
# HTML文件不缓存
ossutil set-meta oss://${OSS_BUCKET}/ Cache-Control:no-cache --include "*.html" -r -f
# 静态资源缓存1年
ossutil set-meta oss://${OSS_BUCKET}/ Cache-Control:max-age=31536000 --include "*.js" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Cache-Control:max-age=31536000 --include "*.css" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Cache-Control:max-age=31536000 --include "*.png" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Cache-Control:max-age=31536000 --include "*.jpg" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Cache-Control:max-age=31536000 --include "*.svg" -r -f

echo ""
echo "================================"
echo "部署完成！"
echo "================================"

if [ -n "$CDN_DOMAIN" ]; then
    echo "访问地址: https://${CDN_DOMAIN}"
    echo ""
    echo "注意: 如果使用CDN，请到阿里云控制台刷新CDN缓存"
    echo "CDN控制台: https://cdn.console.aliyun.com/"
else
    echo "访问地址: https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com/index.html"
fi

echo ""
echo "提示："
echo "1. 确保OSS bucket已开启静态网站托管"
echo "2. 确保OSS bucket设置了正确的跨域规则(CORS)"
echo "3. 如果使用自定义域名，需要在域名解析中添加CNAME记录"
