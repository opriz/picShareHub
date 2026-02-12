#!/bin/bash

# 照片共享服务部署设置脚本

echo "================================"
echo "照片共享服务 - 阿里云部署设置"
echo "================================"
echo ""

# 检查是否有环境变量
if [ -z "$ALIYUN_AK" ] || [ -z "$ALIYUN_SK" ]; then
    echo "❌ 错误: 未找到 ALIYUN_AK 和 ALIYUN_SK 环境变量"
    echo ""
    echo "请在 Cursor Dashboard 中配置以下 Secrets:"
    echo "  - ALIYUN_AK (阿里云 AccessKey ID)"
    echo "  - ALIYUN_SK (阿里云 AccessKey Secret)"
    echo ""
    exit 1
fi

echo "✓ 发现阿里云凭证"
echo ""

# 设置默认值
OSS_REGION=${OSS_REGION:-"cn-hangzhou"}
OSS_BUCKET=${OSS_BUCKET:-"photo-share-$(date +%s)"}

echo "配置信息:"
echo "  区域: $OSS_REGION"
echo "  Bucket: $OSS_BUCKET"
echo ""

# 配置阿里云 CLI
echo "1. 配置阿里云 CLI..."
aliyun configure set \
  --profile default \
  --mode AK \
  --region $OSS_REGION \
  --access-key-id $ALIYUN_AK \
  --access-key-secret $ALIYUN_SK

if [ $? -eq 0 ]; then
    echo "✓ 阿里云 CLI 配置成功"
else
    echo "❌ 阿里云 CLI 配置失败"
    exit 1
fi

# 配置 ossutil
echo ""
echo "2. 配置 ossutil..."
ossutil config -e oss-${OSS_REGION}.aliyuncs.com \
  -i $ALIYUN_AK \
  -k $ALIYUN_SK \
  -L CH

if [ $? -eq 0 ]; then
    echo "✓ ossutil 配置成功"
else
    echo "❌ ossutil 配置失败"
    exit 1
fi

# 尝试创建 Bucket（如果不存在）
echo ""
echo "3. 检查/创建 OSS Bucket..."
ossutil ls oss://${OSS_BUCKET} > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Bucket已存在: $OSS_BUCKET"
else
    echo "创建新的 Bucket: $OSS_BUCKET"
    aliyun oss CreateBucket --bucket-name $OSS_BUCKET --region $OSS_REGION
    
    if [ $? -eq 0 ]; then
        echo "✓ Bucket 创建成功"
        
        # 设置 Bucket 为公共读
        echo "设置 Bucket 权限为公共读..."
        aliyun oss PutBucketAcl --bucket-name $OSS_BUCKET --acl public-read
        
        # 配置静态网站托管
        echo "配置静态网站托管..."
        aliyun oss PutBucketWebsite \
          --bucket-name $OSS_BUCKET \
          --index-document index.html \
          --error-document index.html
        
        echo "✓ Bucket 配置完成"
    else
        echo "❌ Bucket 创建失败，请检查权限或手动创建"
        exit 1
    fi
fi

echo ""
echo "================================"
echo "✓ 部署环境配置完成！"
echo "================================"
echo ""
echo "Bucket 信息:"
echo "  名称: $OSS_BUCKET"
echo "  区域: $OSS_REGION"
echo "  访问地址: http://${OSS_BUCKET}.oss-${OSS_REGION}.aliyuncs.com/"
echo ""
echo "现在可以运行部署脚本:"
echo "  cd frontend && OSS_BUCKET=$OSS_BUCKET ./deploy.sh"
echo ""

# 保存配置供后续使用
echo "export OSS_BUCKET=\"$OSS_BUCKET\"" > /tmp/oss_config.sh
echo "export OSS_REGION=\"$OSS_REGION\"" >> /tmp/oss_config.sh
echo ""
echo "配置已保存到 /tmp/oss_config.sh"
