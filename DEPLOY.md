# PicShare 阿里云部署指南

本文档提供详细的阿里云部署步骤，包括 ECS、RDS、OSS 等服务的配置。

## 📋 前置准备

### 1. 阿里云资源准备

确保你已经准备好以下资源：

- ✅ **ECS 实例** (Ubuntu 20.04+ 或 CentOS 7+)
  - 推荐配置：2核4G 或更高
  - 已配置安全组（开放 22、80、443 端口）
  - 已绑定公网 IP
  
- ✅ **RDS MySQL 实例**
  - MySQL 8.0 或更高版本
  - 已创建数据库和用户
  - 已配置白名单（允许 ECS 访问）
  
- ✅ **OSS 存储桶**
  - 已创建 Bucket
  - 已配置读写权限
  - 已获取 AccessKeyId 和 AccessKeySecret

- ✅ **域名**（可选，但推荐）
  - 已备案（如使用国内服务器）
  - 已解析到 ECS 公网 IP

### 2. 本地环境准备

- Node.js 18+ 和 npm
- Git
- SSH 客户端

## 🚀 部署步骤

### 方式一：一键远程部署（推荐）

这是最简单的方式，从本地直接部署到 ECS。

#### 1. 设置环境变量

在项目根目录创建 `.env.deploy` 文件（或直接导出环境变量）：

```bash
# ECS 配置
export ECS_HOST=你的ECS公网IP或域名
export ECS_USER=root                    # SSH 用户名
export ECS_PORT=22                      # SSH 端口（默认22）
export ECS_KEY=/path/to/your/key.pem   # SSH 密钥路径（可选，使用密码时可省略）

# 数据库配置
export DB_HOST=rm-xxxxx.mysql.rds.aliyuncs.com  # RDS 内网地址（推荐）或公网地址
export DB_PORT=3306
export DB_NAME=picshare
export DB_USER=picshare
export DB_PASSWORD=你的数据库密码

# OSS 配置
export ALIYUN_AK=你的AccessKeyId
export ALIYUN_SK=你的AccessKeySecret
export OSS_BUCKET=你的OSS Bucket名称
export OSS_REGION=oss-cn-hangzhou      # 根据你的 OSS 区域修改

# 域名配置（可选）
export DOMAIN=www.yourdomain.com        # 你的域名，如无域名可使用IP

# 管理员配置（可选）
export ADMIN_EMAIL=admin@yourdomain.com
export ADMIN_PASSWORD=你的管理员密码
```

#### 2. 加载环境变量并部署

```bash
# 加载环境变量
source .env.deploy

# 确保部署脚本有执行权限
chmod +x deploy-remote.sh

# 执行部署
bash deploy-remote.sh
```

部署脚本会自动：
1. 构建前端项目
2. 打包应用
3. 上传到 ECS
4. 在服务器上执行部署脚本
5. 配置 Nginx、systemd 等服务

### 方式二：手动部署

如果需要更多控制，可以手动执行部署步骤。

#### 1. 连接到 ECS

```bash
ssh root@你的ECS公网IP
```

#### 2. 在服务器上克隆项目

```bash
cd /tmp
git clone https://github.com/opriz/picShareHub.git
cd picShareHub
```

#### 3. 设置环境变量

```bash
export DB_HOST=rm-xxxxx.mysql.rds.aliyuncs.com
export DB_USER=picshare
export DB_PASSWORD=你的数据库密码
export ALIYUN_AK=你的AccessKeyId
export ALIYUN_SK=你的AccessKeySecret
export OSS_BUCKET=你的OSS Bucket名称
export DOMAIN=www.yourdomain.com
```

#### 4. 执行部署脚本

```bash
chmod +x deploy.sh
bash deploy.sh
```

## ⚙️ 详细配置说明

### 数据库配置

#### 创建数据库和用户

如果使用 RDS，需要在 RDS 控制台创建数据库和用户：

```sql
-- 创建数据库
CREATE DATABASE picshare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户（如果使用 RDS，建议在控制台创建）
CREATE USER 'picshare'@'%' IDENTIFIED BY '你的密码';

-- 授权
GRANT ALL PRIVILEGES ON picshare.* TO 'picshare'@'%';
FLUSH PRIVILEGES;
```

#### 配置 RDS 白名单

在 RDS 控制台：
1. 进入实例管理
2. 点击"数据安全性"
3. 添加 ECS 的内网 IP 到白名单

### OSS 配置

#### 创建 Bucket

1. 登录 OSS 控制台
2. 创建 Bucket，选择区域（如：华东1-杭州）
3. 设置读写权限为"私有"（推荐）或"公共读"
4. 记录 Bucket 名称和区域

#### 创建 AccessKey

1. 登录阿里云控制台
2. 进入"访问控制" > "用户"
3. 创建用户或使用现有用户
4. 创建 AccessKey，保存 AccessKeyId 和 AccessKeySecret

**安全建议**：为 OSS 创建专门的子用户，只授予 OSS 相关权限。

### Nginx 配置

部署脚本会自动配置 Nginx，配置文件位于：
```
/etc/nginx/sites-available/picshare
```

如果需要修改，编辑后重启 Nginx：
```bash
sudo nginx -t          # 测试配置
sudo systemctl restart nginx
```

### SSL 证书配置（HTTPS）

#### 使用 Let's Encrypt 免费证书

```bash
# 安装 certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d www.yourdomain.com

# 自动续期（certbot 会自动配置）
```

#### 使用阿里云 SSL 证书

1. 在阿里云 SSL 证书控制台申请证书
2. 下载 Nginx 版本的证书
3. 上传到服务器：
   ```bash
   sudo mkdir -p /etc/nginx/ssl
   sudo cp your-cert.crt /etc/nginx/ssl/
   sudo cp your-cert.key /etc/nginx/ssl/
   ```

4. 修改 Nginx 配置，取消 HTTPS 重定向注释并添加 SSL 配置：

```nginx
server {
    listen 443 ssl http2;
    server_name www.yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/your-cert.crt;
    ssl_certificate_key /etc/nginx/ssl/your-cert.key;
    
    # ... 其他配置
}

server {
    listen 80;
    server_name www.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

### 防火墙配置

#### Ubuntu/Debian (UFW)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

#### CentOS/RHEL (firewalld)

```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

#### 阿里云安全组

在 ECS 控制台配置安全组规则：
- 入方向：允许 22、80、443 端口

## 🔍 验证部署

### 1. 检查服务状态

```bash
# 检查应用服务
sudo systemctl status picshare

# 检查 Nginx
sudo systemctl status nginx

# 查看应用日志
sudo tail -f /var/log/picshare/app.log
```

### 2. 测试 API

```bash
# 健康检查
curl http://你的域名/api/health

# 或使用 IP
curl http://你的ECS公网IP/api/health
```

### 3. 访问前端

在浏览器中访问：
- HTTP: `http://你的域名` 或 `http://你的ECS公网IP`
- HTTPS: `https://你的域名`（配置 SSL 后）

### 4. 测试登录

使用部署时设置的管理员账号登录：
- 邮箱：`admin@yourdomain.com`（或你在 ADMIN_EMAIL 中设置的）
- 密码：你在 ADMIN_PASSWORD 中设置的密码

## 📝 常用管理命令

### 服务管理

```bash
# 启动服务
sudo systemctl start picshare

# 停止服务
sudo systemctl stop picshare

# 重启服务
sudo systemctl restart picshare

# 查看状态
sudo systemctl status picshare

# 查看日志
sudo tail -f /var/log/picshare/app.log
sudo tail -f /var/log/picshare/error.log
```

### 更新部署

当代码更新后，重新运行部署脚本即可：

```bash
# 方式一：远程部署
bash deploy-remote.sh

# 方式二：手动更新
cd /opt/picshare
git pull
npm install --production
sudo systemctl restart picshare
```

### 数据库管理

```bash
# 连接数据库
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME

# 备份数据库
mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME > backup.sql

# 恢复数据库
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < backup.sql
```

### 清理过期数据

定时任务会自动清理过期数据，也可以手动执行：

```bash
cd /opt/picshare
sudo -u picshare node src/scripts/cleanupExpired.js
```

## 🐛 故障排查

### 1. 服务无法启动

```bash
# 查看详细错误
sudo journalctl -u picshare -n 50

# 检查环境变量
sudo -u picshare cat /opt/picshare/.env

# 检查端口占用
sudo netstat -tlnp | grep 3000
```

### 2. 数据库连接失败

- 检查 RDS 白名单是否包含 ECS IP
- 检查数据库用户名密码是否正确
- 检查网络连通性：`ping $DB_HOST`

### 3. OSS 上传失败

- 检查 AccessKey 是否正确
- 检查 Bucket 名称和区域是否正确
- 检查 OSS 权限配置

### 4. Nginx 502 错误

- 检查后端服务是否运行：`sudo systemctl status picshare`
- 检查端口是否正确：`curl http://127.0.0.1:3000/api/health`
- 查看 Nginx 错误日志：`sudo tail -f /var/log/nginx/error.log`

### 5. 前端页面空白

- 检查前端文件是否存在：`ls -la /opt/picshare/public`
- 检查浏览器控制台错误
- 检查 API 地址配置是否正确

## 📊 性能优化建议

### 1. 启用 Gzip 压缩

在 Nginx 配置中添加：

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
```

### 2. 配置 CDN

将静态资源（JS、CSS、图片）通过 CDN 加速：
- 在 OSS 控制台开启 CDN 加速
- 或使用阿里云 CDN 服务

### 3. 数据库优化

- 为常用查询字段添加索引
- 定期清理过期数据
- 考虑使用连接池

### 4. 监控和日志

- 配置阿里云云监控
- 设置日志轮转
- 配置告警规则

## 🔒 安全建议

1. **定期更新系统**
   ```bash
   sudo apt-get update && sudo apt-get upgrade
   ```

2. **使用强密码**
   - 数据库密码
   - 管理员密码
   - SSH 密钥（推荐禁用密码登录）

3. **配置防火墙**
   - 只开放必要端口
   - 限制 SSH 访问 IP

4. **定期备份**
   - 数据库备份
   - 代码备份
   - OSS 数据备份

5. **监控异常**
   - 设置异常登录告警
   - 监控资源使用情况

## 📞 获取帮助

如果遇到问题：

1. 查看日志文件
2. 检查配置文件
3. 参考项目 README.md
4. 提交 Issue 到 GitHub

---

**部署完成后，记得：**
- ✅ 修改默认管理员密码
- ✅ 配置 SSL 证书（HTTPS）
- ✅ 设置域名解析
- ✅ 配置备份策略
- ✅ 设置监控告警

祝部署顺利！🎉
