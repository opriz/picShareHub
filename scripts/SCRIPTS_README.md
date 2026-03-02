# Scripts 使用说明

## 环境配置

所有脚本都需要从 `.env.local` 文件读取敏感配置信息。

### 设置步骤

1. 复制 `.env.example` 到项目根目录的 `.env.local`：
   ```bash
   cp .env.example .env.local
   ```

2. 编辑 `.env.local` 填入真实的配置信息：
   ```bash
   # 阿里云访问密钥
   ACCESS_KEY_ID=your_actual_access_key_id
   ACCESS_KEY_SECRET=your_actual_access_key_secret

   # 数据库配置
   DB_HOST=your_actual_db_host
   DB_PORT=5432
   DB_USER=your_actual_db_user
   DB_PASSWORD=your_actual_db_password
   DB_NAME=your_actual_db_name

   # ALB 配置
   ALB_ID=your_actual_alb_id
   REGION=cn-shanghai
   ```

3. 确保 `.env.local` 已被 `.gitignore` 忽略（已配置）

## 可用脚本

### 阿里云资源管理
- `check-alb-status.js` - 查询 ALB 配置状态
- `setup-alb-simple.js` - 一键配置 ALB 负载均衡
- `query-alb-all-regions.js` - 查询所有区域的 ALB 实例

### DNS 配置
- `setup-dns-auto.js` - 自动配置 DNS 解析到 ALB
- `setup-dns-direct.js` - 非交互式 DNS 配置
- `fix-dns-cdn.js` - 修正 DNS 配置（前端指向 CDN，API 指向 ALB）

### CDN 管理
- `query-cdn-config.js` - 查询阿里云 CDN 配置

### 数据库测试
- `test-db-connection.js` - 测试数据库连接
- `test-login.js` - 测试登录功能
- `test-login-detailed.js` - 详细的登录测试

## 使用示例

```bash
# 测试数据库连接
node scripts/test-db-connection.js

# 查询 ALB 状态
node scripts/check-alb-status.js

# 配置 DNS
node scripts/setup-dns-direct.js
```

## 安全注意事项

⚠️ **重要**:
- 永远不要将 `.env.local` 提交到 Git
- 不要在代码中硬编码敏感信息
- 定期更换访问密钥
- 使用最小权限原则配置 IAM 权限
