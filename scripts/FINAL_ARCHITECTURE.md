# 🎯 PicShare 最终部署架构

## ✅ 当前正确架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户访问层                           │
└────────────┬────────────────────────────────────────────┘
             │
             ├─ 静态文件 (HTML/CSS/JS)
             │  └──────────────────────┐
             │                         ▼
             │              ┌──────────────────────┐
             │              │   阿里云 CDN          │
             │              │  www.picshare.com.cn   │
             │              │  - 缓存静态文件      │
             │              │  - 回源到 ECS        │
             │              └──────────┬───────────┘
             │                         │
             │                         ▼
             │              ┌──────────────────────┐
             │              │   ECS 应用服务器      │
             │              │   /opt/picshare/     │
             │              │   public/             │
             │              │   index.html           │
             │              │   assets/             │
             │              └──────────────────────┘
             │
             └─ API 请求 (/api/*)
                         │
                         ▼
              ┌──────────────────────┐
              │   阿里云 ALB         │
              │  api.picshare.com.cn   │
              │  - HTTP: 80           │
              │  - 健康检查: /health │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   ECS 应用服务器      │
              │   Nginx (80)          │
              │   └─ /api/*           │
              │      └─ Node.js(3000) │
              └──────────┬───────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼               ▼               ▼
  ┌──────────┐  ┌─────────────────┐  ┌──────────────┐
  │  阿里云 RDS│  │  阿里云 OSS      │  │ 阿里云邮件   │
  │ PostgreSQL│  │  对象存储        │  │ 推送服务     │
  └──────────┘  └─────────────────┘  └──────────────┘
```

---

## 📋 DNS 配置详情

### ✅ 已配置的 DNS 记录

| 记录 | 类型 | 主机记录 | 记录值 | 用途 |
|------|------|---------|---------|------|
| ✅ | CNAME | www | www.picshare.com.cn.w.kunlunaq.com | 静态文件 (CDN) |
| ✅ | CNAME | api | alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com | API (ALB) |

### 🌐 访问地址

**前端网站**:
- URL: http://www.picshare.com.cn
- DNS: www.picshare.com.cn → CDN → ECS
- 内容: 静态文件 (HTML/CSS/JS)

**API 接口**:
- URL: http://api.picshare.com.cn
- DNS: api.picshare.com.cn → ALB → ECS
- 内容: API 服务 (/api/*)

**完整访问流程**:
```
用户浏览器访问 www.picshare.com.cn
  ↓
DNS 解析到 CDN (www.picshare.com.cn.w.kunlunaq.com)
  ↓
CDN 返回前端静态文件 (index.html, CSS, JS)
  ↓
浏览器加载并执行 JavaScript
  ↓
前端发起 API 请求到 http://api.picshare.com.cn/api/*
  ↓
DNS 解析到 ALB (alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com)
  ↓
ALB 转发请求到 ECS (后端服务器组)
  ↓
ECS Node.js 处理 API 请求
  ↓
返回数据给前端
```

---

## 🔄 架构优势

### 前端静态文件 (CDN)
- ✅ **全球加速**: CDN 边缘节点
- ✅ **高可用**: 多节点容灾
- ✅ **低延迟**: 就近访问
- ✅ **减轻压力**: 不经过 ALB 和 ECS
- ✅ **缓存优化**: 静态资源长期缓存

### API 服务 (ALB)
- ✅ **负载均衡**: 可添加多台 ECS
- ✅ **健康检查**: 自动故障转移
- ✅ **水平扩展**: 流量增长时扩容
- ✅ **SSL 卸载**: 未来可配置 HTTPS
- ✅ **会话保持**: 可配置粘性会话

---

## 📂 前端代码配置

### API 基础 URL
```javascript
// frontend/src/utils/api.js
const API_BASE = 'http://api.picshare.com.cn';
```

### 环境变量
```bash
# 构建时设置
VITE_API_URL=http://api.picshare.com.cn npm run build
```

---

## 🚀 部署流程

### 前端部署 (到 CDN)

**方式 1: 通过 deploy-remote.sh** (当前使用)
```bash
# 1. 修改 API 地址
# frontend/src/utils/api.js: API_BASE = 'http://api.picshare.com.cn'

# 2. 构建前端
cd frontend && npm run build

# 3. 部署到 ECS
bash deploy-remote.sh

# CDN 自动回源到 ECS 获取最新文件
```

**方式 2: 直接上传到 OSS**
```bash
# 1. 构建
cd frontend && npm run build

# 2. 上传到 OSS Bucket
# ossutil cp dist/ oss://picshare-photos/frontend/

# 3. 配置 CDN 回源到 OSS
# 在阿里云 CDN 控制台配置
```

### 后端部署 (到 ECS + ALB)

后端已经在 ECS 上运行，ALB 健康检查正常：
- ✅ 状态: 运行中
- ✅ 健康检查: /health (每 10 秒)
- ✅ API 服务: 正常

---

## 📊 监控和管理

### CDN 监控
登录阿里云控制台 → CDN → www.picshare.com.cn
- 流量统计
- 命中率
- 状态码分布
- 回源情况

### ALB 监控
登录阿里云控制台 → 负载均衡 ALB → alb-14trlrvmsf59tp8id4
- QPS (每秒请求数)
- 后端服务器状态
- 健康检查状态
- 流量分布

### ECS 监控
```bash
# 应用状态
ssh root@47.117.182.243 'systemctl status picshare'

# 应用日志
ssh root@47.117.182.243 'tail -f /var/log/picshare/app.log'

# Nginx 日志
ssh root@47.117.182.243 'tail -f /var/log/nginx/access.log'
```

---

## 🔐 管理员账号

```
邮箱: admin@picshare.com.cn
密码: Admin123456!
```

**管理后台**: http://www.picshare.com.cn/admin

---

## ✅ 配置完成检查清单

- [x] **域名 DNS 解析**
  - [x] www.picshare.com.cn → CDN
  - [x] api.picshare.com.cn → ALB
  - [x] DNS 已生效

- [x] **CDN 配置**
  - [x] CDN 域名已创建
  - [x] 回源配置到 ECS
  - [x] 缓存规则已配置

- [x] **ALB 负载均衡**
  - [x] ALB 实例运行
  - [x] HTTP 监听器: 端口 80
  - [x] 后端服务器组配置
  - [x] 健康检查: /health (每 10 秒)

- [x] **ECS 应用部署**
  - [x] 前端已更新 (API 地址)
  - [x] 后端服务运行
  - [x] Nginx 配置正确
  - [x] Systemd 服务管理

- [x] **数据库连接**
  - [x] PostgreSQL 连接正常
  - [x] 表结构已初始化
  - [x] 管理员账号已创建

- [x] **OSS 存储**
  - [x] Bucket 配置完成
  - [x] 访问凭证配置
  - [x] 图片存储功能正常

---

## 💡 下一步优化建议

### 1. 配置 HTTPS (强烈推荐)

**前端 CDN HTTPS**:
```bash
# 在阿里云 CDN 控制台
1. 上传 SSL 证书
2. 配置 HTTPS
3. 开启 HTTP → HTTPS 自动跳转
```

**API ALB HTTPS**:
```bash
# 在阿里云 ALB 控制台
1. 上传 SSL 证书
2. 创建 HTTPS 监听器 (端口 443)
3. 配置 HTTP → HTTPS 重定向
```

### 2. 更新前端 API 为 HTTPS

修改 `frontend/src/utils/api.js`:
```javascript
const API_BASE = 'https://api.picshare.com.cn';
```

### 3. 添加更多 ECS 到 ALB

当流量增长时:
```bash
1. 创建新的 ECS 实例
2. 部署相同应用配置
3. 在 ALB 控制台添加到服务器组
4. 自动负载分发流量
```

### 4. 配置 CDN 缓存规则

优化 CDN 缓存:
```bash
# 静态资源长期缓存
*.js, *.css, *.png, *.jpg → 30 天

# HTML 文件不缓存
index.html → 不缓存

# API 请求不缓存
/api/* → 不缓存（CDN 回源配置）
```

### 5. 设置监控告警

- API 响应时间 > 1s
- 健康检查失败 > 3 次
- ECS CPU > 80%
- 错误率 > 5%

---

## 📞 故障排查

### CDN 访问问题
```bash
# 1. 检查 DNS 解析
nslookup www.picshare.com.cn

# 2. 检查 CDN 状态
# 登录阿里云 CDN 控制台

# 3. 清除 CDN 缓存
# 在 CDN 控制台操作
```

### API 访问问题
```bash
# 1. 检查 ALB 状态
# 登录阿里云 ALB 控制台查看后端服务器健康状态

# 2. 测试 API 健康检查
curl http://api.picshare.com.cn/health

# 3. 查看 ECS 日志
ssh root@47.117.182.243 'tail -f /var/log/picshare/app.log'
```

### 前端加载问题
```bash
# 1. 清除浏览器缓存

# 2. 检查 API 地址配置
# 浏览器控制台查看 Network 面板

# 3. 确认 API 可访问
curl http://api.picshare.com.cn/api/health
```

---

**部署完成时间**: 2026-02-14
**架构类型**: CDN 前端 + ALB API
**状态**: ✅ 全部完成并正常运行
