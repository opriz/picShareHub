# 快速部署指南

由于环境变量还未加载到当前会话，这里提供两种部署方案：

## 方案一：使用阿里云控制台手动部署（最简单）

### 步骤 1: 上传文件到 OSS

1. **登录阿里云 OSS 控制台**: https://oss.console.aliyun.com/

2. **创建或选择 Bucket**:
   - 如果还没有 Bucket，点击"创建 Bucket"
   - 区域选择：杭州（cn-hangzhou）
   - 读写权限：公共读
   - 其他选项默认即可

3. **配置静态网站托管**:
   - 进入 Bucket 设置
   - 找到"基础设置" > "静态页面"
   - 默认首页：`index.html`
   - 默认 404 页：`index.html`
   - 点击保存

4. **上传构建文件**:
   - 点击"文件管理"
   - 将 `frontend/dist/` 目录下的所有文件上传到 Bucket 根目录
   - 上传文件列表：
     ```
     dist/
       ├── index.html
       ├── assets/
       │   ├── index-BvFXG2hv.css
       │   └── index-Uo8U5Yii.js
       └── vite.svg
     ```

5. **访问网站**:
   - 访问地址格式：`http://your-bucket-name.oss-cn-hangzhou.aliyuncs.com/index.html`
   - 或在 Bucket 设置中查看"外网访问域名"

### 步骤 2: 配置 CDN（可选但推荐）

1. **登录 CDN 控制台**: https://cdn.console.aliyun.com/

2. **添加加速域名**:
   - 加速域名：填入你的域名（如：photos.yourdomain.com）
   - 业务类型：图片小文件
   - 源站类型：OSS 域名
   - 源站地址：选择刚创建的 Bucket

3. **配置 HTTPS**（推荐）:
   - 上传 SSL 证书或使用免费证书
   - 开启强制 HTTPS 跳转

4. **配置缓存规则**:
   - HTML 文件：0 秒（不缓存）
   - JS/CSS：31536000 秒（1年）
   - 图片：31536000 秒（1年）

5. **配置 CNAME**:
   - 在你的域名服务商控制台
   - 添加 CNAME 记录指向 CDN 分配的域名

---

## 方案二：命令行部署（需要手动输入凭证）

### 前提条件

构建文件已准备好（在 `frontend/dist/` 目录）

### 步骤 1: 配置 ossutil

```bash
# 配置 ossutil（需要输入你的 AccessKey）
ossutil config
```

按提示输入：
- endpoint: `oss-cn-hangzhou.aliyuncs.com`
- accessKeyID: 你的 AccessKey ID
- accessKeySecret: 你的 AccessKey Secret

### 步骤 2: 创建 Bucket（如果还没有）

```bash
# 设置 Bucket 名称
BUCKET_NAME="your-bucket-name"

# 使用阿里云 CLI 创建
aliyun oss CreateBucket --bucket-name $BUCKET_NAME --region cn-hangzhou

# 设置公共读权限
aliyun oss PutBucketAcl --bucket-name $BUCKET_NAME --acl public-read

# 配置静态网站托管
aliyun oss PutBucketWebsite \
  --bucket-name $BUCKET_NAME \
  --index-document index.html \
  --error-document index.html
```

### 步骤 3: 上传文件

```bash
cd /workspace/frontend

# 上传所有文件
ossutil cp -r -f dist/ oss://$BUCKET_NAME/

# 设置 Content-Type
ossutil set-meta oss://$BUCKET_NAME/ Content-Type:text/html --include "*.html" -r -f
ossutil set-meta oss://$BUCKET_NAME/ Content-Type:text/css --include "*.css" -r -f
ossutil set-meta oss://$BUCKET_NAME/ Content-Type:application/javascript --include "*.js" -r -f
ossutil set-meta oss://$BUCKET_NAME/ Content-Type:image/svg+xml --include "*.svg" -r -f

# 设置缓存策略
ossutil set-meta oss://$BUCKET_NAME/ Cache-Control:no-cache --include "*.html" -r -f
ossutil set-meta oss://$BUCKET_NAME/ Cache-Control:max-age=31536000 --include "*.js" -r -f
ossutil set-meta oss://$BUCKET_NAME/ Cache-Control:max-age=31536000 --include "*.css" -r -f
```

### 步骤 4: 验证部署

访问：`http://your-bucket-name.oss-cn-hangzhou.aliyuncs.com/index.html`

---

## 方案三：等待环境变量加载后自动部署

如果你希望使用自动化脚本，需要：

1. 确保在 Cursor Dashboard 中正确配置了以下 Secrets:
   ```
   ALIYUN_AK = your-access-key-id
   ALIYUN_SK = your-access-key-secret
   ```

2. 重新启动 Cloud Agent 会话

3. 运行自动部署脚本:
   ```bash
   cd /workspace
   ./setup-deployment.sh
   ```

---

## 当前构建文件信息

项目已构建完成，文件位于：`/workspace/frontend/dist/`

构建产物：
- `index.html` (0.46 KB)
- `assets/index-BvFXG2hv.css` (8.46 KB)
- `assets/index-Uo8U5Yii.js` (1,027.55 KB)
- `vite.svg`

总大小约：1 MB

---

## 推荐方案

**最快速的方案**：使用方案一（阿里云控制台），只需要 5-10 分钟即可完成：
1. 创建 OSS Bucket（2分钟）
2. 配置静态网站托管（1分钟）
3. 上传文件（2分钟）
4. 配置 CDN（可选，5分钟）

---

## 需要帮助？

如果你遇到问题，可以：
1. 查看详细文档：`frontend/DEPLOYMENT.md`
2. 查看 Claude Skill：`CLAUDE_SKILL_ALIYUN_DEPLOYMENT.md`
3. 告诉我你选择哪个方案，我可以提供更详细的指导

---

**注意**：建议先使用 OSS 直连测试部署是否成功，确认无误后再配置 CDN 加速。
