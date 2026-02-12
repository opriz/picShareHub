# 照片共享服务前端部署指南

## 部署架构

```
用户 → CDN → OSS Bucket → 静态网站
         ↓
    缓存加速 + 回源
```

## 前置准备

### 1. 阿里云资源准备

#### OSS Bucket 设置

1. 登录阿里云控制台：https://oss.console.aliyun.com/
2. 创建或选择一个OSS Bucket（建议在杭州区域）
3. 配置静态网站托管：
   - 进入 Bucket > 基础设置 > 静态页面
   - 默认首页：`index.html`
   - 默认404页：`index.html`（用于SPA路由）
   - 开启子目录首页

4. 配置CORS规则：
   ```json
   {
     "allowedOrigins": ["*"],
     "allowedMethods": ["GET", "POST", "PUT", "DELETE", "HEAD"],
     "allowedHeaders": ["*"],
     "exposeHeaders": ["ETag", "x-oss-request-id"],
     "maxAgeSeconds": 3600
   }
   ```

5. 设置Bucket权限：
   - 读写权限：公共读（如果使用CDN可以设置为私有）

#### CDN 配置

1. 登录CDN控制台：https://cdn.console.aliyun.com/
2. 添加加速域名：
   - 加速域名：your-domain.com
   - 业务类型：图片小文件
   - 源站信息：选择 OSS 域名
   - 选择你的 OSS Bucket

3. 配置HTTPS（推荐）：
   - 上传SSL证书或使用免费证书
   - 开启HTTPS安全加速
   - 开启HTTP/2

4. 配置缓存规则：
   - HTML文件：不缓存（0秒）
   - JS/CSS：长缓存（1年）
   - 图片：长缓存（1年）

5. 配置回源设置：
   - 回源HOST：Bucket域名
   - 回源协议：HTTPS

#### 域名解析

1. 登录域名控制台
2. 添加CNAME记录：
   - 记录类型：CNAME
   - 主机记录：@ 或 www
   - 记录值：CDN分配的CNAME地址
   - TTL：10分钟

### 2. 本地环境准备

安装必要的工具：

```bash
# 安装 Node.js 依赖
npm install

# 安装 ossutil（阿里云OSS命令行工具）
wget http://gosspublic.alicdn.com/ossutil/1.7.15/ossutil64
chmod +x ossutil64
sudo mv ossutil64 /usr/local/bin/ossutil
```

### 3. 配置环境变量

创建 `.env.production` 文件：

```bash
# 阿里云OSS配置
VITE_OSS_REGION=oss-cn-hangzhou
VITE_OSS_ACCESS_KEY_ID=your_access_key_id
VITE_OSS_ACCESS_KEY_SECRET=your_access_key_secret
VITE_OSS_BUCKET=your_bucket_name

# CDN域名
VITE_CDN_DOMAIN=your-cdn-domain.com
```

## 部署方式

### 方式一：使用自动化脚本部署

1. 设置环境变量：

```bash
export OSS_BUCKET="your-bucket-name"
export OSS_REGION="oss-cn-hangzhou"
export OSS_ACCESS_KEY_ID="your-access-key-id"
export OSS_ACCESS_KEY_SECRET="your-access-key-secret"
export CDN_DOMAIN="your-cdn-domain.com"  # 可选
```

2. 运行部署脚本：

```bash
chmod +x deploy.sh
./deploy.sh
```

脚本会自动完成：
- 安装依赖
- 构建项目
- 上传到OSS
- 设置文件类型
- 配置缓存策略

### 方式二：手动部署

#### 步骤1: 构建项目

```bash
npm install
npm run build
```

#### 步骤2: 配置 ossutil

```bash
ossutil config -e oss-cn-hangzhou.aliyuncs.com \
  -i your-access-key-id \
  -k your-access-key-secret \
  -L CH
```

#### 步骤3: 上传文件到 OSS

```bash
# 上传所有文件
ossutil cp -r -f dist/ oss://your-bucket-name/
```

#### 步骤4: 设置文件 Content-Type

```bash
# HTML 文件
ossutil set-meta oss://your-bucket-name/ \
  Content-Type:text/html --include "*.html" -r -f

# CSS 文件
ossutil set-meta oss://your-bucket-name/ \
  Content-Type:text/css --include "*.css" -r -f

# JavaScript 文件
ossutil set-meta oss://your-bucket-name/ \
  Content-Type:application/javascript --include "*.js" -r -f

# SVG 文件
ossutil set-meta oss://your-bucket-name/ \
  Content-Type:image/svg+xml --include "*.svg" -r -f
```

#### 步骤5: 设置缓存策略

```bash
# HTML 文件不缓存
ossutil set-meta oss://your-bucket-name/ \
  Cache-Control:no-cache --include "*.html" -r -f

# 静态资源长缓存（1年）
ossutil set-meta oss://your-bucket-name/ \
  Cache-Control:max-age=31536000 --include "*.js" -r -f

ossutil set-meta oss://your-bucket-name/ \
  Cache-Control:max-age=31536000 --include "*.css" -r -f

ossutil set-meta oss://your-bucket-name/ \
  Cache-Control:max-age=31536000 --include "*.png" -r -f

ossutil set-meta oss://your-bucket-name/ \
  Cache-Control:max-age=31536000 --include "*.jpg" -r -f
```

#### 步骤6: 刷新 CDN 缓存

如果使用了CDN，需要刷新缓存：

1. 登录CDN控制台：https://cdn.console.aliyun.com/
2. 进入 刷新预热 页面
3. 选择 URL刷新 或 目录刷新
4. 输入需要刷新的URL或目录
5. 提交刷新任务

或使用阿里云CLI：

```bash
# 刷新首页
aliyun cdn RefreshObjectCaches \
  --ObjectPath https://your-cdn-domain.com/index.html \
  --ObjectType File

# 刷新整个目录
aliyun cdn RefreshObjectCaches \
  --ObjectPath https://your-cdn-domain.com/ \
  --ObjectType Directory
```

## CI/CD 集成

### GitHub Actions 示例

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Aliyun OSS

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Build
        run: npm run build
        env:
          VITE_OSS_REGION: ${{ secrets.OSS_REGION }}
          VITE_OSS_BUCKET: ${{ secrets.OSS_BUCKET }}
          VITE_CDN_DOMAIN: ${{ secrets.CDN_DOMAIN }}
        
      - name: Install ossutil
        run: |
          wget http://gosspublic.alicdn.com/ossutil/1.7.15/ossutil64
          chmod +x ossutil64
          sudo mv ossutil64 /usr/local/bin/ossutil
          
      - name: Configure ossutil
        run: |
          ossutil config -e ${{ secrets.OSS_ENDPOINT }} \
            -i ${{ secrets.OSS_ACCESS_KEY_ID }} \
            -k ${{ secrets.OSS_ACCESS_KEY_SECRET }} \
            -L CH
            
      - name: Upload to OSS
        run: |
          ossutil cp -r -f dist/ oss://${{ secrets.OSS_BUCKET }}/
          
      - name: Set file headers
        run: |
          ossutil set-meta oss://${{ secrets.OSS_BUCKET }}/ \
            Content-Type:text/html --include "*.html" -r -f
          ossutil set-meta oss://${{ secrets.OSS_BUCKET }}/ \
            Content-Type:text/css --include "*.css" -r -f
          ossutil set-meta oss://${{ secrets.OSS_BUCKET }}/ \
            Content-Type:application/javascript --include "*.js" -r -f
```

需要在 GitHub Secrets 中配置：
- `OSS_REGION`
- `OSS_ENDPOINT`
- `OSS_BUCKET`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `CDN_DOMAIN`

## 访问测试

部署完成后，通过以下方式访问：

1. **OSS直连访问**（用于测试）：
   ```
   https://your-bucket-name.oss-cn-hangzhou.aliyuncs.com/index.html
   ```

2. **CDN加速访问**（推荐）：
   ```
   https://your-cdn-domain.com
   ```

## 性能优化建议

1. **启用 Gzip 压缩**：在 OSS 控制台开启 Gzip 压缩
2. **使用 CDN**：全站 CDN 加速，降低访问延迟
3. **图片优化**：使用 OSS 图片处理服务（webp 格式、压缩等）
4. **资源预加载**：在 index.html 中添加关键资源的预加载标签
5. **代码分割**：Vite 自动进行代码分割，按需加载

## 安全建议

1. **不要在前端暴露 AccessKey**：
   - 使用 STS 临时凭证
   - 通过后端 API 获取上传凭证

2. **配置 Bucket 防盗链**：
   - 在 OSS 控制台设置 Referer 白名单

3. **启用 HTTPS**：
   - 所有访问都通过 HTTPS
   - 在 CDN 配置强制跳转 HTTPS

4. **配置 CSP 策略**：
   - 在响应头中添加 Content-Security-Policy

## 监控和日志

1. **OSS 访问日志**：
   - 在 OSS 控制台开启日志存储
   - 定期分析访问日志

2. **CDN 监控**：
   - 查看 CDN 流量、带宽使用情况
   - 设置告警规则

3. **性能监控**：
   - 使用阿里云 ARMS 应用监控
   - 监控页面加载时间、错误率等

## 故障排查

### 问题1: 页面无法访问

- 检查 OSS Bucket 权限设置
- 检查 CDN 配置是否正确
- 检查域名解析是否生效

### 问题2: 样式/脚本加载失败

- 检查 Content-Type 设置是否正确
- 检查 CORS 配置
- 清空浏览器缓存重试

### 问题3: 图片上传失败

- 检查 OSS 权限配置
- 查看浏览器控制台错误信息
- 验证 AccessKey 是否有效

## 成本估算

基于中等流量网站（10GB存储，100GB月流量）：

- OSS 存储费用：约 ¥2/月
- OSS 流量费用：约 ¥50/月（不使用CDN）
- CDN 流量费用：约 ¥20/月（使用CDN）
- 总计：约 ¥22-52/月

## 联系支持

- 阿里云工单：https://workorder.console.aliyun.com/
- OSS 文档：https://help.aliyun.com/product/31815.html
- CDN 文档：https://help.aliyun.com/product/27099.html
