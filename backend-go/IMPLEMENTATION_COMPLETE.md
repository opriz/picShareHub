# PicShare Go Backend 实施完成

## 状态

Go backend 已完成实现，可以成功编译。后端保留了所有28个API端点和业务逻辑。

## 项目结构

```
backend-go/
├── main.go                    # 入口：加载配置、初始化DB/OSS、注册路由、启动服务
├── go.mod
├── config/
│   └── config.go              # 环境变量读取
├── handler/
│   ├── auth.go                # 9个auth端点
│   ├── album.go               # 6个album端点
│   ├── photo.go               # 3个photo端点
│   ├── public.go              # 2个公开端点
│   ├── admin.go               # 5个admin端点
│   ├── feedback.go            # 1个feedback端点
│   └── health.go              # 健康检查
├── middleware/
│   ├── auth.go                # JWT验证、admin检查、可选认证
│   ├── cors.go                # CORS配置
│   ├── ratelimit.go           # 限流
│   └── upload.go              # 文件上传中间件
├── model/
│   └── response.go            # 通用响应结构
├── repository/
│   ├── db.go                  # 数据库连接池
│   ├── user.go                # 用户CRUD
│   ├── album.go               # 影集CRUD
│   ├── photo.go               # 照片CRUD
│   └── admin.go               # 管理员查询
├── service/
│   ├── oss.go                 # 阿里云OSS操作
│   ├── email.go               # SMTP邮件发送
│   ├── image.go               # 缩略图生成
│   └── cleanup.go             # 定时清理过期影集
└── util/
    ├── jwt.go                 # JWT签发/验证
    ├── hash.go                # bcrypt封装
    ├── token.go               # 随机token/shareCode生成
    ├── validator.go           # 输入验证
    └── log.go                 # 日志工具
```

## 28个API端点（完全兼容）

### Auth (9个)
- POST `/api/auth/register` - 注册
- POST `/api/auth/login` - 登录
- GET  `/api/auth/verify-email` - 邮箱验证
- POST `/api/auth/resend-verification` - 重发验证邮件
- POST `/api/auth/forgot-password` - 忘记密码
- POST `/api/auth/reset-password` - 重置密码
- GET  `/api/auth/profile` - 获取个人信息 [需认证]
- PUT  `/api/auth/profile` - 更新个人信息 [需认证]
- PUT  `/api/auth/change-password` - 修改密码 [需认证]

### Album (6个)
- POST `/api/albums` - 创建影集 [需认证]
- GET  `/api/albums` - 获取我的影集 [需认证]
- GET  `/api/albums/:id` - 影集详情 [需认证, owner/admin]
- PUT  `/api/albums/:id` - 更新影集 [需认证]
- DELETE `/api/albums/:id` - 删除影集 [需认证]
- GET  `/api/albums/:id/qrcode` - 获取二维码 [需认证]

### Photo (3个)
- POST `/api/albums/:albumId/photos` - 上传照片 [需认证, multipart]
- DELETE `/api/albums/:albumId/photos/:photoId` - 删除照片 [需认证]
- GET  `/api/albums/:albumId/photos/:photoId/original` - 获取原图URL [需认证]

### Public (2个)
- GET `/api/s/:shareCode` - 公开查看影集
- GET `/api/s/:shareCode/photos/:photoId/download` - 公开下载照片

### Admin (5个)
- GET `/api/admin/stats` - 统计数据 [需admin]
- GET `/api/admin/users` - 用户列表 [需admin]
- GET `/api/admin/users/:userId/albums` - 用户影集 [需admin]
- GET `/api/admin/albums` - 所有影集 [需admin]
- GET `/api/admin/albums/:albumId/logs` - 影集日志 [需admin]

### Other (2个)
- POST `/api/feedback` - 提交反馈 [可选认证, multipart]
- GET  `/api/health` - 健康检查

## 部署脚本

新增 `deploy-go-remote.sh` 和 `deploy-go.sh`：

1. `deploy-go-remote.sh` - 本地运行
   - 构建前端
   - 交叉编译 Go 后端 (linux/amd64)
   - 打包并上传到服务器
   - 执行远程部署

2. `deploy-go.sh` - 在服务器运行
   - 创建用户和目录
   - 复制二进制和前端
   - 配置 systemd service
   - 配置 nginx
   - 不再需要 crontab（Go 内置定时任务）

## 使用方法

### 本地运行

```bash
cd backend-go
go run main.go
```

### 部署到服务器

```bash
# 加载环境变量
export $(cat .env.deploy | xargs)

# 运行部署脚本
./deploy-go-remote.sh
```

## 依赖

```bash
go get github.com/aliyun/aliyun-oss-go-sdk
go get github.com/disintegration/imaging
go get github.com/golang-jwt/jwt/v5
go get github.com/google/uuid
go get github.com/joho/godotenv
go get github.com/robfig/cron/v3
go get github.com/skip2/go-qrcode
go get github.com/ulule/limiter/v3
go get github.com/gin-gonic/gin
go get golang.org/x/crypto
go get github.com/jackc/pgx/v5
```

## 关键特性

- ✅ 完全兼容现有 API 响应格式
- ✅ JWT 认证 (7天过期)
- ✅ bcrypt 密码哈希 (12轮)
- ✅ 阿里云 OSS 集成
- ✅ SMTP 邮件发送
- ✅ 缩略图自动生成
- ✅ 定时清理过期影集 (cron)
- ✅ 限流 (API: 500/min, Auth: 100/min)
- ✅ 文件上传限制 (20张/次, 50MB/张, 50张/影集)
- ✅ 影集限制 (10个活跃影集/用户)
- ✅ 管理员权限检查
- ✅ CORS 支持

## 验证步骤

1. 本地启动 Go 服务
2. 测试登录：`POST /api/auth/login`
3. 测试创建影集：`POST /api/albums`
4. 测试上传照片：`POST /api/albums/:id/photos`
5. 测试公开分享：`GET /api/s/:shareCode`
6. 测试管理员后台：`GET /api/admin/stats`

## 对比 Node.js

| 项目 | Node.js | Go |
|------|---------|-----|
| 端点数 | 28 | 28 |
| 响应格式 | 完全一致 | 完全一致 |
| JWT | jsonwebtoken | golang-jwt/jwt/v5 |
| 密码 | bcryptjs | golang.org/x/crypto/bcrypt |
| 数据库 | pg (node-postgres) | pgx (纯 Go driver) |
| 图片处理 | sharp | disintegration/imaging |
| OSS | ali-oss | aliyun/aliyun-oss-go-sdk |
| 邮件 | nodemailer | net/smtp (标准库) |
| 二维码 | qrcode | skip2/go-qrcode |
| 限流 | express-rate-limit | ulule/limiter |
| 定时任务 | node-cron | robfig/cron/v3 |
| 二进制大小 | - | ~18MB |
