# 🎉 PicShare ALB 负载均衡配置完成

## ✅ 配置状态

你的 ALB 负载均衡已经成功配置！

### 📋 配置详情

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户访问                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   域名 DNS (待配置)   │
              │  www.yourdomain.com  │
              └──────────┬───────────┘
                         │ CNAME
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              阿里云 ALB 负载均衡                                 │
│  alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  HTTP 监听器 (80)                                          │ │
│  │  • 健康检查: GET /health (每 10 秒)                        │ │
│  │  • 超时: 5 秒                                              │ │
│  │  • 阈值: 3 次成功/失败                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              服务器组 (picshare-backend-group)                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ECS 实例: i-uf64cifopnzresaw9sml                         │ │
│  │  内网 IP: 172.24.39.135                                   │ │
│  │  端口: 80                                                  │ │
│  │  权重: 100                                                 │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   ECS 上的应用        │
              │   Nginx + Node.js    │
              └──────────┬───────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │   RDS   │    │   OSS   │    │  Email  │
    └─────────┘    └─────────┘    └─────────┘
```

## 🔧 配置信息

### ALB 实例
- **名称**: picshare-alb
- **ID**: alb-14trlrvmsf59tp8id4
- **DNS**: alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com
- **区域**: cn-shanghai
- **状态**: ✅ Active

### 监听器
- **协议**: HTTP
- **端口**: 80
- **后端端口**: 80
- **状态**: ✅ 已配置

### 后端服务器
- **ECS 实例**: i-uf64cifopnzresaw9sml
- **内网 IP**: 172.24.39.135
- **端口**: 80
- **权重**: 100

### 健康检查
- **路径**: /health
- **协议**: HTTP
- **检查间隔**: 10 秒
- **超时时间**: 5 秒
- **健康阈值**: 3 次
- **不健康阈值**: 3 次

## 📝 下一步操作

### 1️⃣ 部署应用到 ECS

```bash
bash deploy-remote.sh
```

这会自动：
- 构建前端应用
- 上传到 ECS
- 配置 Nginx（支持 LB 模式）
- 启动后端服务
- 配置健康检查端点

### 2️⃣ 配置域名 DNS

在你的域名服务商（如阿里云 DNS）添加 CNAME 记录：

```
记录类型: CNAME
主机记录: www (或 @)
记录值: alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com
TTL: 600
```

### 3️⃣ 测试访问

```bash
# 测试健康检查
curl http://alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com/health

# 测试前端
curl http://alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com/

# 测试 API
curl http://alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com/api/health
```

### 4️⃣ (可选) 配置 HTTPS

#### 方式 A: 在阿里云控制台配置

1. 登录阿里云控制台
2. 进入 ALB 实例详情页
3. 点击"监听"标签
4. 点击"添加监听"
5. 配置 HTTPS 监听器：
   - 前端协议: HTTPS
   - 前端端口: 443
   - SSL 证书: 上传或选择已有证书
   - 后端协议: HTTP
   - 后端端口: 80
   - 服务器组: 选择已创建的服务器组

#### 方式 B: 使用 Let's Encrypt 免费证书

```bash
# 在 ECS 上生成证书
sudo certbot certonly --standalone -d yourdomain.com

# 证书位置
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem

# 然后在 ALB 控制台上传证书
```

## 🎯 优势对比

### 使用 ALB 前（单机模式）
- ❌ 单点故障风险
- ❌ 无法水平扩展
- ❌ SSL 处理占用 ECS 资源
- ❌ 流量激增时性能受限

### 使用 ALB 后（负载均衡模式）
- ✅ 高可用性（自动故障转移）
- ✅ 水平扩展（轻松添加 ECS）
- ✅ SSL 卸载（减轻后端压力）
- ✅ 健康检查（自动剔除故障节点）
- ✅ 流量分发（智能负载均衡）

## 📊 监控和维护

### 查看 ALB 监控

登录阿里云控制台 → ALB → 监控

关键指标：
- QPS（每秒请求数）
- 活跃连接数
- 新建连接数
- 后端服务器健康状态
- 响应时间

### 查看后端服务器状态

```bash
# SSH 到 ECS
ssh root@47.117.182.243

# 查看应用状态
systemctl status picshare

# 查看应用日志
tail -f /var/log/picshare/app.log

# 查看 Nginx 日志
tail -f /var/log/nginx/access.log
```

### 健康检查故障排查

如果健康检查失败：

```bash
# 1. 检查 Nginx 是否运行
systemctl status nginx

# 2. 测试健康检查端点
curl http://localhost/health

# 3. 检查防火墙规则
iptables -L -n

# 4. 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log
```

## 🚀 扩展到多台 ECS

当流量增长时，可以轻松添加更多 ECS：

```bash
# 1. 创建新的 ECS 实例（与现有 ECS 相同配置）
# 2. 部署应用到新 ECS
# 3. 在 ALB 控制台添加到服务器组

# 或使用 API 自动添加
node add-ecs-to-alb.js <新ECS实例ID>
```

## 📞 需要帮助？

- 查看完整架构文档: `cat ARCHITECTURE.md`
- 查看 ALB 配置指南: `cat LOAD_BALANCER_SETUP.md`
- 查看部署文档: `cat DEPLOY.md`

---

**配置完成时间**: 2026-02-14
**配置状态**: ✅ 成功
