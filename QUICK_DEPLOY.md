# 🚀 快速部署指南

这是最简化的部署流程，适合快速上手。详细说明请查看 [DEPLOY.md](./DEPLOY.md)。

## 📋 前置条件

- ✅ 阿里云 ECS 实例（Ubuntu/CentOS）
- ✅ 阿里云 RDS MySQL 实例
- ✅ 阿里云 OSS Bucket
- ✅ 已获取 AccessKey（ID 和 Secret）

## ⚡ 三步部署

### 1. 配置环境变量

复制示例文件并编辑：

```bash
cp .env.deploy.example .env.deploy
nano .env.deploy  # 或使用你喜欢的编辑器
```

**必填项：**
- `ECS_HOST` - ECS 公网 IP
- `DB_HOST` - RDS 地址
- `DB_USER` - 数据库用户名
- `DB_PASSWORD` - 数据库密码
- `ALIYUN_AK` - AccessKeyId
- `ALIYUN_SK` - AccessKeySecret
- `OSS_BUCKET` - OSS Bucket 名称

### 2. 执行部署

```bash
bash deploy-remote.sh
```

脚本会自动完成所有部署步骤，大约需要 5-10 分钟。

### 3. 验证部署

```bash
# 访问网站
curl http://你的ECS公网IP

# 或使用浏览器访问
# http://你的ECS公网IP
```

## 🔧 常见问题

### Q: 部署失败怎么办？

**A:** 检查以下几点：

1. **SSH 连接**
   ```bash
   ssh root@你的ECS公网IP
   ```

2. **环境变量**
   ```bash
   echo $ECS_HOST
   echo $DB_HOST
   ```

3. **查看日志**
   ```bash
   ssh root@你的ECS公网IP 'tail -f /var/log/picshare/app.log'
   ```

### Q: 如何更新代码？

**A:** 重新运行部署脚本即可：

```bash
bash deploy-remote.sh
```

### Q: 如何配置 HTTPS？

**A:** 使用 Let's Encrypt 免费证书：

```bash
ssh root@你的ECS公网IP
sudo certbot --nginx -d 你的域名
```

### Q: 忘记管理员密码？

**A:** 重置管理员：

```bash
ssh root@你的ECS公网IP
cd /opt/picshare
sudo -u picshare node src/scripts/seedAdmin.js
```

## 📞 需要帮助？

查看详细文档：[DEPLOY.md](./DEPLOY.md)

---

**提示：** 首次部署建议使用测试环境，确认无误后再部署到生产环境。
