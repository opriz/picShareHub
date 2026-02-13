# PicShare - 摄影师照片分享平台

一个为摄影师设计的照片即时分享平台。摄影师可以快速上传照片、生成二维码，客户扫码即可查看和下载。

## 功能特性

- **账号系统** - 邮箱注册/登录，JWT 认证
- **一键创建影集** - 自动以时间命名，快速创建
- **照片上传** - 支持批量上传，自动生成缩略图
- **二维码分享** - 一键生成二维码，客户扫码查看
- **缩略图优化** - 浏览用缩略图，下载用原图，节省流量
- **自动过期** - 默认24小时过期，可手动设置
- **后台清理** - 定时任务自动清理过期数据
- **管理后台** - 查看所有用户/影集/访问统计
- **移动端适配** - 完美适配手机浏览器

## 技术栈

| 层 | 技术 |
|-----|------|
| 前端 | React 19 + Vite 7 + React Router |
| 后端 | Node.js + Express |
| 数据库 | MySQL 8.0 (阿里云 RDS) |
| 存储 | 阿里云 OSS |
| 部署 | 阿里云 ECS + Nginx |

## 项目结构

```
picShareHub/
├── frontend/          # React 前端
│   ├── src/
│   │   ├── pages/     # 页面组件
│   │   ├── components/# 通用组件
│   │   ├── contexts/  # React Context
│   │   └── utils/     # API 调用工具
│   └── dist/          # 构建产物
├── backend/           # Express 后端
│   └── src/
│       ├── controllers/  # 业务逻辑
│       ├── routes/       # 路由定义
│       ├── middleware/   # 中间件
│       ├── config/       # 配置
│       ├── utils/        # 工具函数
│       └── scripts/      # 脚本
├── deploy.sh          # ECS 部署脚本
└── deploy-remote.sh   # 远程部署脚本
```

## 快速开始

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/opriz/picShareHub.git
cd picShareHub

# 2. 后端
cd backend
cp .env.example .env  # 编辑配置
npm install
npm run db:init       # 初始化数据库
npm run db:seed       # 创建管理员
npm start

# 3. 前端 (新终端)
cd frontend
npm install
npm run dev
```

### 部署到 ECS

```bash
# 设置环境变量
export ECS_HOST=你的ECS公网IP
export DB_HOST=数据库地址
export DB_PASSWORD=数据库密码
export ALIYUN_AK=AccessKeyId
export ALIYUN_SK=AccessKeySecret
export OSS_BUCKET=你的OSS Bucket

# 部署
bash deploy-remote.sh
```

## 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| DB_HOST | 数据库地址 | 是 |
| DB_PORT | 数据库端口 | 否 (默认 3306) |
| DB_NAME | 数据库名 | 否 (默认 picshare) |
| DB_USER | 数据库用户 | 是 |
| DB_PASSWORD | 数据库密码 | 是 |
| OSS_BUCKET | OSS Bucket 名 | 是 |
| OSS_REGION | OSS 区域 | 否 (默认 oss-cn-hangzhou) |
| ALIYUN_AK | AccessKeyId | 是 |
| ALIYUN_SK | AccessKeySecret | 是 |
| JWT_SECRET | JWT 密钥 | 否 (自动生成) |
| FRONTEND_URL | 前端域名 | 否 |

## API 端点

### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/profile` - 获取个人信息

### 影集
- `POST /api/albums` - 创建影集
- `GET /api/albums` - 我的影集列表
- `GET /api/albums/:id` - 影集详情
- `PUT /api/albums/:id` - 更新影集
- `DELETE /api/albums/:id` - 删除影集
- `GET /api/albums/:id/qrcode` - 获取二维码

### 照片
- `POST /api/albums/:id/photos` - 上传照片
- `DELETE /api/albums/:albumId/photos/:photoId` - 删除照片

### 公开接口
- `GET /api/s/:shareCode` - 查看影集
- `GET /api/s/:shareCode/photos/:id/download` - 下载原图

### 管理员
- `GET /api/admin/stats` - 统计数据
- `GET /api/admin/users` - 用户列表
- `GET /api/admin/albums` - 影集列表
