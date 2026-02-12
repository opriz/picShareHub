# Claude Skill: 阿里云前端项目部署

## 技能描述

这是一个标准化的阿里云前端项目部署流程，适用于将静态网站/单页应用(SPA)部署到阿里云OSS + CDN架构。

## 适用场景

- React/Vue/Angular 等前端单页应用
- 静态网站
- 需要高性能、低成本的前端部署方案
- 需要CDN加速的全球访问场景

## 前置条件

### 必需资源

1. **阿里云账号**
   - 已开通OSS服务
   - 已开通CDN服务（可选但推荐）

2. **域名**（可选）
   - 已备案的域名
   - 域名解析权限

3. **开发环境**
   - Node.js 环境（用于前端构建）
   - Git（版本控制）

### 必需信息

- OSS Bucket 名称
- OSS 区域（如：oss-cn-hangzhou）
- OSS AccessKeyId
- OSS AccessKeySecret
- CDN 域名（如使用CDN）

## 部署架构

```
用户请求
    ↓
CDN节点（缓存）
    ↓（回源）
OSS Bucket（静态网站托管）
    ↓
前端资源文件
```

**优势**：
- 成本低：按量付费，小型应用每月仅需几元
- 性能高：CDN全球加速
- 可靠性：阿里云基础设施
- 易维护：无需服务器管理

## 标准化部署流程

### 第一步：创建和配置OSS Bucket

```bash
# 使用阿里云控制台或CLI创建Bucket
aliyun oss mb oss://your-bucket-name --region cn-hangzhou
```

**控制台配置**：

1. 登录 https://oss.console.aliyun.com/
2. 创建 Bucket：
   - 区域：选择靠近用户的区域（如杭州）
   - 存储类型：标准存储
   - 读写权限：公共读（如使用CDN可设为私有）
   - 服务器端加密：按需选择

3. 配置静态网站托管：
   - 进入 Bucket > 基础设置 > 静态页面
   - 默认首页：`index.html`
   - 默认404页：`index.html`（用于SPA路由）
   - 开启子目录首页

4. 配置CORS（跨域访问）：
   ```json
   {
     "allowedOrigins": ["*"],
     "allowedMethods": ["GET", "POST", "PUT", "DELETE", "HEAD"],
     "allowedHeaders": ["*"],
     "exposeHeaders": ["ETag", "x-oss-request-id"],
     "maxAgeSeconds": 3600
   }
   ```

### 第二步：配置CDN加速（推荐）

1. 登录 https://cdn.console.aliyun.com/
2. 添加加速域名：
   - 加速域名：your-domain.com
   - 业务类型：图片小文件
   - 源站类型：OSS域名
   - 源站地址：选择创建的Bucket

3. 配置HTTPS（强烈推荐）：
   - 上传SSL证书或使用免费证书
   - 开启强制HTTPS跳转
   - 开启HTTP/2

4. 配置缓存规则：
   - HTML文件：0秒（不缓存，确保更新即时生效）
   - JS/CSS/图片：31536000秒（1年，长缓存）

5. 配置回源设置：
   - 回源HOST：Bucket域名
   - 回源协议：HTTPS优先

### 第三步：域名解析

1. 登录域名服务商控制台
2. 添加CNAME记录：
   - 类型：CNAME
   - 主机记录：@ 或 www
   - 记录值：CDN分配的CNAME地址
   - TTL：600（10分钟）

### 第四步：准备前端项目

1. **配置环境变量**

创建 `.env.production` 文件：

```bash
VITE_OSS_REGION=oss-cn-hangzhou
VITE_OSS_BUCKET=your-bucket-name
VITE_CDN_DOMAIN=your-cdn-domain.com
# 注意：不要在前端暴露 AccessKey
```

2. **安装 ossutil 工具**

```bash
# Linux/Mac
wget http://gosspublic.alicdn.com/ossutil/1.7.15/ossutil64
chmod +x ossutil64
sudo mv ossutil64 /usr/local/bin/ossutil

# Windows
# 下载 http://gosspublic.alicdn.com/ossutil/1.7.15/ossutil64.exe
```

3. **配置 ossutil**

```bash
ossutil config -e oss-cn-hangzhou.aliyuncs.com \
  -i YOUR_ACCESS_KEY_ID \
  -k YOUR_ACCESS_KEY_SECRET \
  -L CH
```

### 第五步：创建部署脚本

创建 `deploy.sh` 文件：

```bash
#!/bin/bash
set -e

echo "开始部署..."

# 1. 构建项目
echo "1. 构建项目..."
npm install
npm run build

# 2. 上传到OSS
echo "2. 上传文件到OSS..."
ossutil cp -r -f dist/ oss://${OSS_BUCKET}/

# 3. 设置文件类型
echo "3. 设置Content-Type..."
ossutil set-meta oss://${OSS_BUCKET}/ Content-Type:text/html --include "*.html" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Content-Type:text/css --include "*.css" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Content-Type:application/javascript --include "*.js" -r -f

# 4. 设置缓存策略
echo "4. 设置缓存策略..."
ossutil set-meta oss://${OSS_BUCKET}/ Cache-Control:no-cache --include "*.html" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Cache-Control:max-age=31536000 --include "*.js" -r -f
ossutil set-meta oss://${OSS_BUCKET}/ Cache-Control:max-age=31536000 --include "*.css" -r -f

echo "部署完成！"
echo "访问地址: https://${CDN_DOMAIN}"
```

### 第六步：执行部署

```bash
# 设置环境变量
export OSS_BUCKET="your-bucket-name"
export OSS_REGION="oss-cn-hangzhou"
export OSS_ACCESS_KEY_ID="your-access-key-id"
export OSS_ACCESS_KEY_SECRET="your-access-key-secret"
export CDN_DOMAIN="your-cdn-domain.com"

# 执行部署
chmod +x deploy.sh
./deploy.sh
```

### 第七步：刷新CDN缓存

如果是更新部署，需要刷新CDN：

```bash
# 方式1：使用阿里云CLI
aliyun cdn RefreshObjectCaches \
  --ObjectPath https://your-cdn-domain.com/index.html \
  --ObjectType File

# 方式2：控制台操作
# 访问 https://cdn.console.aliyun.com/ 进行刷新
```

### 第八步：验证部署

1. 访问域名检查网站是否正常
2. 检查浏览器开发者工具：
   - Network标签查看资源加载
   - Console标签查看是否有错误
3. 测试各项功能是否正常

## CI/CD 集成模板

### GitHub Actions

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Aliyun OSS

on:
  push:
    branches: [ main ]

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
      run: npm ci
    
    - name: Build
      run: npm run build
      env:
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
    
    - name: Deploy to OSS
      run: |
        ossutil cp -r -f dist/ oss://${{ secrets.OSS_BUCKET }}/
        ossutil set-meta oss://${{ secrets.OSS_BUCKET }}/ \
          Content-Type:text/html --include "*.html" -r -f
        ossutil set-meta oss://${{ secrets.OSS_BUCKET }}/ \
          Cache-Control:no-cache --include "*.html" -r -f
    
    - name: Refresh CDN
      run: |
        aliyun cdn RefreshObjectCaches \
          --ObjectPath https://${{ secrets.CDN_DOMAIN }}/ \
          --ObjectType Directory
      env:
        ALIBABA_CLOUD_ACCESS_KEY_ID: ${{ secrets.OSS_ACCESS_KEY_ID }}
        ALIBABA_CLOUD_ACCESS_KEY_SECRET: ${{ secrets.OSS_ACCESS_KEY_SECRET }}
```

**需要配置的 GitHub Secrets**：
- `OSS_BUCKET`
- `OSS_ENDPOINT`（如：oss-cn-hangzhou.aliyuncs.com）
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `CDN_DOMAIN`

## 快速检查清单

部署前检查：

- [ ] OSS Bucket 已创建并配置
- [ ] 静态网站托管已开启
- [ ] CORS 规则已配置
- [ ] CDN 已配置并绑定域名
- [ ] 域名 CNAME 已解析
- [ ] SSL 证书已配置
- [ ] ossutil 已安装和配置
- [ ] 环境变量已设置

部署后检查：

- [ ] 网站可以正常访问
- [ ] HTTPS 正常工作
- [ ] 静态资源加载正常
- [ ] SPA 路由正常工作
- [ ] 控制台无错误信息
- [ ] CDN 缓存策略生效

## 常见问题和解决方案

### 问题1：页面404

**原因**：SPA路由未正确配置
**解决**：将OSS的默认404页设置为 `index.html`

### 问题2：样式/脚本加载失败

**原因**：Content-Type 设置错误
**解决**：使用 ossutil 正确设置文件类型

### 问题3：更新不生效

**原因**：CDN缓存未刷新
**解决**：手动刷新CDN缓存或减少HTML文件缓存时间

### 问题4：CORS错误

**原因**：跨域规则未配置
**解决**：在OSS控制台配置CORS规则

### 问题5：图片上传失败

**原因**：前端直接使用 AccessKey（不安全）
**解决**：使用STS临时凭证或通过后端API获取上传凭证

## 成本估算

基于中小型网站（月访问量10万PV）：

| 项目 | 用量 | 价格 |
|------|------|------|
| OSS存储 | 10GB | ¥2/月 |
| OSS流量 | 50GB | ¥25/月（不用CDN） |
| CDN流量 | 50GB | ¥10/月（使用CDN） |
| CDN请求 | 100万次 | ¥1/月 |
| **总计** | - | **¥13/月**（使用CDN） |

**节省建议**：
- 使用CDN可节省60%流量成本
- 静态资源长缓存可减少回源
- 图片使用webp格式可减少30%流量

## 安全最佳实践

1. **不在前端暴露 AccessKey**
   - 使用 STS 临时凭证
   - 后端 API 提供上传凭证

2. **配置防盗链**
   - OSS控制台设置 Referer 白名单
   - CDN配置防盗链

3. **启用HTTPS**
   - 全站HTTPS
   - 强制HTTPS跳转

4. **访问控制**
   - 使用 RAM 子账号
   - 最小权限原则

5. **内容安全**
   - 配置 CSP 策略
   - XSS 防护

## 监控和优化

### 监控指标

1. **OSS监控**
   - 存储量趋势
   - 请求量和流量
   - 错误率

2. **CDN监控**
   - 流量和带宽
   - 命中率
   - 延迟时间

3. **性能监控**
   - 页面加载时间
   - 首屏时间
   - 资源加载时间

### 优化建议

1. **代码优化**
   - 代码分割（Code Splitting）
   - Tree Shaking
   - 压缩混淆

2. **资源优化**
   - 图片压缩和格式优化（webp）
   - 字体子集化
   - SVG优化

3. **缓存优化**
   - 静态资源文件名带hash
   - 合理设置缓存时间
   - 使用CDN预热

4. **加载优化**
   - 关键资源预加载
   - 非关键资源延迟加载
   - 使用 HTTP/2

## 总结

这个部署方案具有以下优势：

1. **低成本**：按量付费，小型应用每月十几元
2. **高性能**：CDN全球加速，访问速度快
3. **高可用**：阿里云基础设施，SLA 99.9%
4. **易维护**：无需管理服务器，自动伸缩
5. **易扩展**：支持海量并发访问

适合绝大多数前端项目的部署需求！

## 参考文档

- [阿里云OSS文档](https://help.aliyun.com/product/31815.html)
- [阿里云CDN文档](https://help.aliyun.com/product/27099.html)
- [ossutil工具文档](https://help.aliyun.com/document_detail/120075.html)
- [静态网站托管配置](https://help.aliyun.com/document_detail/31872.html)

---

**版本**: 1.0.0
**更新时间**: 2026-02-12
**适用范围**: 所有静态网站和单页应用的阿里云部署
