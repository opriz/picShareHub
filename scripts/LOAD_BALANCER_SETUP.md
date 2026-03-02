# 🔄 负载均衡配置指南

本文档介绍如何为 PicShare 配置阿里云负载均衡（SLB/CLB）。

## 📋 架构说明

### 传统架构（无 LB）
```
用户 → ECS (Nginx + Node.js) → RDS + OSS
```

### 负载均衡架构（推荐）
```
用户 → 负载均衡 (SLB) → ECS (Nginx + Node.js) → RDS + OSS
```

## ✨ 负载均衡优势

1. **高可用性**: 自动故障转移，单台 ECS 故障不影响服务
2. **弹性扩展**: 轻松添加更多 ECS 实例应对流量增长
3. **SSL 卸载**: 在 LB 层处理 HTTPS，减轻后端压力
4. **健康检查**: 自动检测后端服务器健康状态
5. **流量分发**: 智能分配请求到多台服务器

## 🚀 快速配置

### 方式一：自动创建和配置（推荐）

```bash
# 1. 确保 .env.deploy 已配置
cat .env.deploy

# 2. 运行自动配置脚本
node setup-load-balancer.js
```

脚本会自动完成：
- ✅ 创建 CLB 实例
- ✅ 添加后端 ECS 服务器
- ✅ 配置 HTTP 监听（端口 80）
- ✅ 配置健康检查
- ✅ 启动负载均衡

### 方式二：手动配置

#### 1. 创建负载均衡实例

登录阿里云控制台 → 负载均衡 → 创建实例

**配置参数：**
- **实例类型**: 传统型负载均衡 (CLB)
- **地域**: 与 ECS 相同（如：华东1-上海）
- **网络类型**: 公网
- **计费方式**: 按流量计费
- **规格**: 简约型 I (slb.s1.small)

#### 2. 配置监听规则

**HTTP 监听（端口 80）：**
```
前端协议: HTTP
前端端口: 80
后端协议: HTTP
后端端口: 80
调度算法: 加权轮询 (WRR)
会话保持: 关闭
```

**健康检查配置：**
```
健康检查: 开启
检查路径: /health
检查间隔: 10 秒
响应超时: 5 秒
健康阈值: 3 次
不健康阈值: 3 次
```

#### 3. 添加后端服务器

- 选择你的 ECS 实例
- 端口: 80
- 权重: 100

#### 4. 配置 HTTPS（可选）

**HTTPS 监听（端口 443）：**
```
前端协议: HTTPS
前端端口: 443
后端协议: HTTP
后端端口: 80
SSL 证书: 上传或选择已有证书
```

## 🔧 ECS 配置更新

### 1. 部署应用（支持 LB）

```bash
# 使用支持 LB 的部署脚本
bash deploy-with-lb.sh
```

### 2. Nginx 配置说明

部署脚本会自动配置 Nginx，关键配置包括：

```nginx
# 获取真实客户端 IP
set_real_ip_from 0.0.0.0/0;
real_ip_header X-Forwarded-For;
real_ip_recursive on;

# 健康检查端点
location /health {
    access_log off;
    return 200 "healthy\n";
    add_header Content-Type text/plain;
}

# API 代理（传递真实 IP）
location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header X-Real-IP $real_ip;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 3. 安全组配置

**ECS 安全组规则：**
```
入方向规则:
- 允许 HTTP (80) 来自负载均衡内网 IP
- 允许 SSH (22) 来自管理 IP
- 拒绝其他所有入站流量
```

**负载均衡安全组规则：**
```
入方向规则:
- 允许 HTTP (80) 来自 0.0.0.0/0
- 允许 HTTPS (443) 来自 0.0.0.0/0
```

## 🌐 DNS 配置

### 更新域名解析

将域名指向负载均衡地址：

```
类型: A 记录
主机记录: www
记录值: [负载均衡公网 IP]
TTL: 600
```

或使用 CNAME（如果 LB 提供域名）：

```
类型: CNAME
主机记录: www
记录值: [负载均衡域名]
TTL: 600
```

## 📊 监控和测试

### 1. 健康检查测试

```bash
# 测试健康检查端点
curl http://[负载均衡IP]/health

# 预期输出: healthy
```

### 2. 完整功能测试

```bash
# 测试前端访问
curl http://[负载均衡IP]

# 测试 API
curl http://[负载均衡IP]/api/health

# 测试真实 IP 传递
curl -H "X-Forwarded-For: 1.2.3.4" http://[负载均衡IP]/api/health
```

### 3. 查看负载均衡监控

登录阿里云控制台 → 负载均衡 → 监控

查看指标：
- QPS（每秒请求数）
- 活跃连接数
- 新建连接数
- 后端服务器健康状态

## 🔐 HTTPS 配置

### 1. 准备 SSL 证书

**选项 A: 使用阿里云免费证书**
```bash
# 登录阿里云控制台
# SSL 证书 → 购买证书 → 免费证书
# 申请并下载证书
```

**选项 B: Let's Encrypt 证书**
```bash
# 在 ECS 上生成证书
sudo certbot certonly --standalone -d yourdomain.com
# 证书位置: /etc/letsencrypt/live/yourdomain.com/
```

### 2. 上传证书到负载均衡

```bash
# 方式 1: 通过控制台上传
# 负载均衡 → 证书管理 → 创建证书

# 方式 2: 通过 API 上传（自动化）
# 使用 setup-load-balancer.js 中的证书上传功能
```

### 3. 配置 HTTPS 监听

```
前端协议: HTTPS
前端端口: 443
SSL 证书: 选择已上传的证书
后端协议: HTTP (SSL 卸载)
后端端口: 80
```

### 4. HTTP 自动跳转 HTTPS

在负载均衡配置 HTTP 监听的转发规则：
```
条件: 所有请求
动作: 重定向到 HTTPS
```

## 🎯 最佳实践

### 1. 多可用区部署

```
负载均衡: 主可用区 + 备可用区
ECS 实例: 分布在不同可用区
```

### 2. 会话保持

如果应用需要会话保持：
```
会话保持: 开启
保持方式: 植入 Cookie
超时时间: 1800 秒
```

### 3. 访问控制

```bash
# 配置白名单（仅允许特定 IP 访问）
# 负载均衡 → 访问控制 → 创建访问控制策略
```

### 4. 监控告警

```
设置告警规则:
- 后端服务器不健康数 > 0
- QPS 超过阈值
- 响应时间超过阈值
```

## 🔍 故障排查

### 问题 1: 健康检查失败

**检查项：**
```bash
# 1. ECS 上 Nginx 是否运行
systemctl status nginx

# 2. 健康检查端点是否可访问
curl http://localhost/health

# 3. 安全组是否允许 LB 访问
# 检查 ECS 安全组规则

# 4. 查看 Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 问题 2: 无法获取真实 IP

**检查项：**
```bash
# 1. Nginx 配置是否正确
cat /etc/nginx/sites-available/picshare | grep real_ip

# 2. 后端应用是否读取 X-Forwarded-For
# 检查 backend/src/app.js
```

### 问题 3: 502 Bad Gateway

**检查项：**
```bash
# 1. 后端服务是否运行
systemctl status picshare

# 2. 后端端口是否监听
netstat -tlnp | grep 3000

# 3. 查看后端日志
tail -f /var/log/picshare/app.log
```

## 📈 扩展到多台 ECS

### 1. 准备新的 ECS 实例

```bash
# 在新 ECS 上部署应用
scp -r /opt/picshare root@新ECS:/opt/
ssh root@新ECS 'bash /opt/picshare/deploy-with-lb.sh'
```

### 2. 添加到负载均衡

```bash
# 方式 1: 通过控制台
# 负载均衡 → 后端服务器 → 添加服务器

# 方式 2: 通过 API
# 使用 setup-load-balancer.js 的扩展功能
```

### 3. 验证负载分发

```bash
# 多次请求，观察是否分发到不同服务器
for i in {1..10}; do
  curl -s http://[负载均衡IP]/api/health | grep server
done
```

## 📝 配置文件参考

### .env.deploy 示例

```bash
# ECS 配置
export ECS_HOST=47.117.182.243
export ECS_USER=root
export ECS_REGION=cn-shanghai

# 负载均衡配置
export LB_ADDRESS=123.456.789.012
export LB_ID=lb-xxxxxxxxxx
export USE_LB=true

# 数据库配置
export DB_HOST=rm-xxxxxxxxxx.mysql.rds.aliyuncs.com
export DB_USER=picshare
export DB_PASSWORD=your_password

# OSS 配置
export OSS_BUCKET=photo-share-hub-20260212
export OSS_REGION=oss-cn-hangzhou

# 阿里云凭证
export ALIYUN_AK=your_access_key
export ALIYUN_SK=your_secret_key
```

## 🎉 完成检查清单

- [ ] 负载均衡实例已创建
- [ ] HTTP 监听已配置（端口 80）
- [ ] HTTPS 监听已配置（端口 443）
- [ ] 后端 ECS 已添加
- [ ] 健康检查配置正确
- [ ] ECS 应用已部署（LB 模式）
- [ ] Nginx 配置已更新
- [ ] 安全组规则已配置
- [ ] DNS 解析已更新
- [ ] 健康检查测试通过
- [ ] 完整功能测试通过
- [ ] 监控告警已配置

## 📞 需要帮助？

- 查看阿里云负载均衡文档: https://help.aliyun.com/product/27537.html
- 查看项目部署文档: [DEPLOY.md](./DEPLOY.md)
- 提交 Issue: https://github.com/your-repo/issues

---

**提示**: 首次配置建议在测试环境验证，确认无误后再应用到生产环境。
