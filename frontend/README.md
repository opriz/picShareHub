# 📸 PhotoShare - 照片共享服务

一个现代化的照片共享 Web 应用，具有精美的瀑布流布局和流畅的动画效果。

## ✨ 特性

- 🎨 **炫酷的用户界面** - 使用 Framer Motion 实现流畅的动画效果
- 📱 **响应式设计** - 完美适配各种屏幕尺寸
- 🌊 **瀑布流布局** - 优雅的照片展示方式
- ☁️ **云端存储** - 集成阿里云 OSS，支持海量照片存储
- ⚡ **CDN 加速** - 通过阿里云 CDN 实现全球加速访问
- 🚀 **快速部署** - 一键部署到阿里云

## 🛠️ 技术栈

- **React** - 用户界面库
- **Vite** - 下一代前端构建工具
- **Framer Motion** - 动画库
- **React Masonry CSS** - 瀑布流布局
- **阿里云 OSS** - 对象存储服务
- **阿里云 CDN** - 内容分发网络

## 📦 安装

```bash
# 克隆项目
git clone <your-repo-url>
cd frontend

# 安装依赖
npm install
```

## 🔧 配置

复制 `.env.example` 到 `.env` 并填入你的配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
VITE_OSS_REGION=oss-cn-hangzhou
VITE_OSS_ACCESS_KEY_ID=your_access_key_id
VITE_OSS_ACCESS_KEY_SECRET=your_access_key_secret
VITE_OSS_BUCKET=your_bucket_name
VITE_CDN_DOMAIN=your_cdn_domain.com
```

**注意**：如果不配置 OSS，应用会以本地模式运行，照片只存储在浏览器中。

## 🚀 开发

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 📤 部署

### 部署到阿里云 OSS + CDN

详细部署指南请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)

#### 快速部署

1. 设置环境变量：

```bash
export OSS_BUCKET="your-bucket-name"
export OSS_REGION="oss-cn-hangzhou"
export OSS_ACCESS_KEY_ID="your-access-key-id"
export OSS_ACCESS_KEY_SECRET="your-access-key-secret"
export CDN_DOMAIN="your-cdn-domain.com"
```

2. 运行部署脚本：

```bash
chmod +x deploy.sh
./deploy.sh
```

## 📁 项目结构

```
frontend/
├── public/              # 静态资源
├── src/
│   ├── components/      # React 组件
│   │   ├── Header.jsx
│   │   ├── PhotoUpload.jsx
│   │   ├── PhotoGallery.jsx
│   │   └── PhotoCard.jsx
│   ├── config/          # 配置文件
│   │   └── oss.config.js
│   ├── utils/           # 工具函数
│   │   └── ossClient.js
│   ├── App.jsx          # 主应用组件
│   ├── App.css          # 主样式
│   └── main.jsx         # 应用入口
├── .env.example         # 环境变量示例
├── deploy.sh            # 部署脚本
├── deploy-config.json   # 部署配置
├── DEPLOYMENT.md        # 部署文档
└── package.json         # 项目配置
```

## 🎯 使用说明

1. **上传照片**
   - 点击右上角的"上传照片"按钮
   - 选择图片文件
   - 添加标题和描述（可选）
   - 点击上传

2. **查看照片**
   - 瀑布流展示所有照片
   - 点击照片查看大图
   - 支持点赞和删除操作

3. **管理照片**
   - 悬停在照片上显示操作按钮
   - 点击垃圾桶图标删除照片
   - 点击爱心图标点赞

## 🔒 安全建议

⚠️ **重要**：不要在前端代码中暴露 OSS AccessKey！

生产环境建议：
1. 使用 STS 临时凭证
2. 通过后端 API 获取上传凭证
3. 配置 Bucket 防盗链
4. 启用 HTTPS

## 📈 性能优化

- ✅ 代码分割和懒加载
- ✅ 图片懒加载
- ✅ CDN 加速
- ✅ Gzip 压缩
- ✅ 资源缓存策略

## 🐛 问题反馈

如遇到问题，请查看 [DEPLOYMENT.md](./DEPLOYMENT.md) 中的故障排查章节。

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
