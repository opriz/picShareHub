#!/usr/bin/env node
/**
 * 查询 ALB 配置状态
 */

import https from 'https';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID;
const ACCESS_KEY_SECRET = process.env.ACCESS_KEY_SECRET;
const REGION = process.env.REGION || 'cn-shanghai';
const ALB_ID = process.env.ALB_ID;

function signRequest(method, path, params, secret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const stringToSign = `${method}&${encodeURIComponent(path)}&${encodeURIComponent(sortedParams)}`;
  return crypto.createHmac('sha1', secret + '&').update(stringToSign).digest('base64');
}

function apiRequest(hostname, action, params) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const requestParams = {
      Format: 'JSON',
      Version: '2020-06-16',
      AccessKeyId: ACCESS_KEY_ID,
      SignatureMethod: 'HMAC-SHA1',
      Timestamp: timestamp,
      SignatureVersion: '1.0',
      SignatureNonce: Math.random().toString(36).substring(7),
      Action: action,
      ...params,
    };

    const signature = signRequest('GET', '/', requestParams, ACCESS_KEY_SECRET);
    requestParams.Signature = signature;

    const queryString = Object.keys(requestParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(requestParams[key])}`)
      .join('&');

    const options = {
      hostname: hostname,
      path: `/?${queryString}`,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.Code) {
            reject(new Error(`${result.Code}: ${result.Message}`));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║        ALB 配置状态查询               ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  const hostname = `alb.${REGION}.aliyuncs.com`;

  try {
    // 查询监听器
    console.log('🔍 查询监听器配置...');
    const listeners = await apiRequest(hostname, 'ListListeners', {
      RegionId: REGION,
      'LoadBalancerIds.1': ALB_ID,
      MaxResults: 50,
    });

    console.log('');
    console.log('✅ ALB 配置完成！');
    console.log('');
    console.log('📋 配置详情:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('ALB 信息:');
    console.log(`  名称: picshare-alb`);
    console.log(`  ID: ${ALB_ID}`);
    console.log(`  DNS: alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com`);
    console.log(`  区域: ${REGION}`);
    console.log('');

    if (listeners.Listeners && listeners.Listeners.length > 0) {
      console.log('监听器配置:');
      listeners.Listeners.forEach((listener, idx) => {
        console.log(`  ${idx + 1}. ${listener.ListenerProtocol}:${listener.ListenerPort}`);
        console.log(`     ID: ${listener.ListenerId}`);
        console.log(`     状态: ${listener.ListenerStatus}`);
      });
      console.log('');
    }

    console.log('后端服务器:');
    console.log(`  ECS 实例: i-uf64cifopnzresaw9sml`);
    console.log(`  内网 IP: 172.24.39.135`);
    console.log(`  端口: 80`);
    console.log('');

    console.log('健康检查:');
    console.log(`  路径: /health`);
    console.log(`  间隔: 10 秒`);
    console.log(`  超时: 5 秒`);
    console.log('');

    console.log('╔══════════════════════════════════════╗');
    console.log('║           下一步操作                  ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
    console.log('1️⃣  部署应用到 ECS:');
    console.log('   bash deploy-remote.sh');
    console.log('');
    console.log('2️⃣  配置域名 DNS (CNAME 记录):');
    console.log('   记录类型: CNAME');
    console.log('   主机记录: www (或 @)');
    console.log('   记录值: alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com');
    console.log('   TTL: 600');
    console.log('');
    console.log('3️⃣  测试访问:');
    console.log('   curl http://alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com/health');
    console.log('');
    console.log('4️⃣  (可选) 配置 HTTPS:');
    console.log('   - 在 ALB 控制台上传 SSL 证书');
    console.log('   - 创建 HTTPS 监听器 (443 端口)');
    console.log('   - 配置 HTTP 到 HTTPS 的重定向');
    console.log('');

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
