# 🌐 DNS 配置指南

## 当前状态

✅ ALB 负载均衡：已配置
- DNS: alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com

✅ ECS 应用：已部署
- 公网 IP: 47.117.182.243
- API 状态: ✅ 正常

⚠️  **需要配置：DNS 解析**

---

## 📝 DNS 配置方案

### 方案 1：使用已有域名（推荐）

如果你有域名，将域名指向 ALB：

#### 在阿里云 DNS 配置

1. 登录阿里云控制台：https://dns.aliyun.com
2. 找到你的域名
3. 点击"解析设置"
4. 添加记录：

```
记录类型: CNAME
主机记录: @
记录值: alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com
TTL: 600
```

5. 如果需要 www 子域名，再添加一条：

```
记录类型: CNAME
主机记录: www
记录值: alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com
TTL: 600
```

#### 在其他 DNS 服务商配置

如果你使用的是 Cloudflare、GoDaddy 等：

```
类型: CNAME
名称: @ (或 www)
值: alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com
TTL: 600 (或自动)
代理: 关闭 (DNS only)
```

### 方案 2：使用阿里云免费域名

如果你没有域名，可以在阿里云申请免费子域名：

1. 登录阿里云控制台
2. 搜索"云解析 DNS"
3. 找到"免费域名"或"域名注册"
4. 申请免费 .top / .xin 等域名（有限时优惠）
5. 按照方案 1 配置 DNS

### 方案 3：暂时使用 ALB DNS 直接访问

在 DNS 配置完成前，可以直接使用 ALB 的 DNS：

```
http://alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com
```

**注意**: 这个地址比较长，不便于记忆和分享。

---

## 🔄 DNS 生效时间

### 国内 DNS
- 通常 **5-10 分钟**生效
- 最长可能需要 **24 小时**

### 国际 DNS
- 通常 **30 分钟 - 2 小时**生效
- 最长可能需要 **48 小时**

### 检查 DNS 是否生效

```bash
# 方法 1: 使用 nslookup
nslookup yourdomain.com

# 方法 2: 使用 dig
dig yourdomain.com

# 方法 3: 使用 ping
ping yourdomain.com

# 方法 4: 在线工具
# 访问 https://tool.chinaz.com/dns/
```

---

## ✅ DNS 配置完成后的验证

### 1. 检查域名解析

```bash
# 替换为你的域名
curl -I http://yourdomain.com

# 应该看到:
# HTTP/1.1 200 OK
# Server: nginx
```

### 2. 测试前端访问

```bash
curl http://yourdomain.com

# 应该看到完整的 HTML 页面
```

### 3. 测试 API

```bash
curl http://yourdomain.com/api/health

# 应该返回:
# {"status":"ok","timestamp":"2026-02-14T...","env":"production"}
```

### 4. 测试健康检查

```bash
curl http://yourdomain.com/health

# 应该返回:
# healthy
```

---

## 🔧 常见问题

### Q1: DNS 配置后还是无法访问？

**A**: 检查以下几点：

1. **DNS 是否生效**
   ```bash
   nslookup yourdomain.com
   # 查看是否指向 ALB 的 IP
   ```

2. **ALB 安全组配置**
   - 确保 ALB 安全组允许 80/443 端口
   - 入站规则：0.0.0.0/0 → 80, 443

3. **ECS 安全组配置**
   - 确保允许来自 ALB 的访问
   - 或者临时开放 80 端口到 0.0.0.0/0

### Q2: ALB 返回 403 错误？

**A**: 可能原因：

1. **健康检查失败**
   - 检查 ECS 上的 /health 端点是否可访问
   ```bash
   ssh root@47.117.182.243
   curl http://localhost/health
   ```

2. **后端服务器未就绪**
   - 检查服务器组状态
   - 等待 1-2 分钟后重试

3. **安全组拦截**
   - 检查 ECS 安全组是否允许 ALB 访问

### Q3: 如何知道 DNS 指向哪里？

**A**: 使用 DNS 查询工具

```bash
# Windows
nslookup yourdomain.com

# Linux/Mac
dig yourdomain.com

# 或
host yourdomain.com
```

---

## 📊 配置检查清单

完成 DNS 配置后，使用此清单检查：

- [ ] DNS 记录已添加（CNAME → ALB DNS）
- [ ] DNS 已生效（nslookup 确认）
- [ ] 域名可以访问（curl 测试通过）
- [ ] 前端页面正常显示
- [ ] API 健康检查通过
- [ ] 可以登录管理后台
- [ ] 上传图片功能正常
- [ ] (可选) HTTPS 证书已配置

---

## 🎯 完整访问流程示例

配置完成后，访问流程应该是：

```
用户浏览器
    ↓
输入: http://yourdomain.com
    ↓
DNS 解析 → ALB DNS (alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com)
    ↓
ALB 负载均衡（端口 80）
    ↓
健康检查: GET /health (每 10 秒)
    ↓
转发到后端: ECS (172.24.39.135:80)
    ↓
ECS Nginx
    ├─ / → 静态文件 (/opt/picshare/public/)
    └─ /api/* → Node.js (127.0.0.1:3000)
    ↓
返回响应 → 用户看到网页
```

---

## 💡 后续优化建议

DNS 配置完成后，可以考虑：

1. **配置 CDN 加速**
   - 为静态资源配置 CDN
   - 提升访问速度

2. **配置 HTTPS**
   - 在 ALB 上传 SSL 证书
   - 创建 HTTPS 监听器
   - 配置 HTTP → HTTPS 重定向

3. **配置缓存规则**
   - 为静态资源配置长时间缓存
   - 减少 ALB 和 ECS 压力

4. **添加更多 ECS**
   - 当流量增长时
   - 在服务器组中添加更多 ECS 实例

---

**文档更新时间**: 2026-02-14
**下一步**: [返回部署架构](./ARCHITECTURE.md) | [ALB 配置详情](./ALB_CONFIGURED.md)
