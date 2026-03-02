#!/usr/bin/env node
/**
 * 一键配置 ALB 负载均衡
 */

import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
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
const ECS_INSTANCE_ID = 'i-uf64cifopnzresaw9sml';
const ECS_PRIVATE_IP = '172.24.39.135';
const VPC_ID = 'vpc-uf67e2i20lcz2fabcckrv';

// 阿里云 API 签名
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║        配置 ALB 负载均衡              ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log(`ALB ID: ${ALB_ID}`);
  console.log(`ECS 实例: ${ECS_INSTANCE_ID}`);
  console.log(`ECS 内网IP: ${ECS_PRIVATE_IP}`);
  console.log(`VPC: ${VPC_ID}`);
  console.log('');

  const hostname = `alb.${REGION}.aliyuncs.com`;

  // 1. 创建服务器组
  console.log('📦 步骤 1/3: 创建服务器组...');
  try {
    const result = await apiRequest(hostname, 'CreateServerGroup', {
      RegionId: REGION,
      ServerGroupName: 'picshare-backend-group-' + Date.now(),
      VpcId: VPC_ID,
      Protocol: 'HTTP',
      Scheduler: 'Wrr',
      'HealthCheckConfig.HealthCheckEnabled': 'true',
      'HealthCheckConfig.HealthCheckProtocol': 'HTTP',
      'HealthCheckConfig.HealthCheckPath': '/health',
      'HealthCheckConfig.HealthCheckTimeout': '5',
      'HealthCheckConfig.HealthCheckInterval': '10',
      'HealthCheckConfig.HealthyThreshold': '3',
      'HealthCheckConfig.UnhealthyThreshold': '3',
      'HealthCheckConfig.HealthCheckHttpCodes.1': 'http_2xx',
      'StickySessionConfig.StickySessionEnabled': 'false',
    });

    console.log(`✅ 服务器组创建成功! ID: ${result.ServerGroupId}`);
    console.log('');

    const serverGroupId = result.ServerGroupId;

    // 等待服务器组就绪
    console.log('⏳ 等待服务器组就绪（可能需要几秒）...');
    await sleep(5000);

    // 2. 添加 ECS 到服务器组（带重试）
    console.log('🖥️  步骤 2/3: 添加 ECS 到服务器组...');
    let added = false;
    for (let i = 0; i < 5; i++) {
      try {
        await apiRequest(hostname, 'AddServersToServerGroup', {
          RegionId: REGION,
          ServerGroupId: serverGroupId,
          'Servers.1.ServerType': 'Ecs',
          'Servers.1.ServerId': ECS_INSTANCE_ID,
          'Servers.1.Port': '80',
          'Servers.1.Weight': '100',
        });
        console.log('✅ ECS 添加成功!');
        console.log(`   实例: ${ECS_INSTANCE_ID}`);
        console.log(`   端口: 80`);
        console.log(`   权重: 100`);
        console.log('');
        added = true;
        break;
      } catch (error) {
        if (i < 4 && error.message.includes('IncorrectStatus')) {
          console.log(`   状态未就绪，等待 3 秒... (${i + 1}/5)`);
          await sleep(3000);
          continue;
        }
        console.log(`❌ 添加失败: ${error.message}`);
        break;
      }
    }

    if (!added) {
      throw new Error('无法添加 ECS 到服务器组');
    }

    // 3. 创建监听器
    console.log('🔌 步骤 3/3: 创建 HTTP 监听器...');
    const listenerResult = await apiRequest(hostname, 'CreateListener', {
      RegionId: REGION,
      LoadBalancerId: ALB_ID,
      ListenerProtocol: 'HTTP',
      ListenerPort: '80',
      'DefaultActions.1.Type': 'ForwardGroup',
      'DefaultActions.1.ForwardGroupConfig.ServerGroupTuples.1.ServerGroupId': serverGroupId,
    });

    console.log('✅ 监听器创建成功!');
    console.log(`   ID: ${listenerResult.ListenerId}`);
    console.log(`   端口: 80`);
    console.log('');

    // 完成
    console.log('╔══════════════════════════════════════╗');
    console.log('║           ✅ 配置完成！               ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
    console.log('📋 配置信息:');
    console.log(`   ALB ID: ${ALB_ID}`);
    console.log(`   ALB DNS: alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com`);
    console.log(`   服务器组 ID: ${serverGroupId}`);
    console.log(`   监听器 ID: ${listenerResult.ListenerId}`);
    console.log('');
    console.log('💡 下一步:');
    console.log('   1. 部署应用到 ECS: bash deploy-remote.sh');
    console.log('   2. 配置域名 DNS CNAME 到: alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com');
    console.log('   3. 测试访问: curl http://alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com/health');
    console.log('');

    // 保存配置
    fs.writeFileSync(
      path.join(process.cwd(), '.lb-info.json'),
      JSON.stringify({
        type: 'ALB',
        id: ALB_ID,
        dnsName: 'alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com',
        serverGroupId: serverGroupId,
        listenerId: listenerResult.ListenerId,
        ecsInstanceId: ECS_INSTANCE_ID,
        createdAt: new Date().toISOString(),
      }, null, 2)
    );
    console.log('✅ 配置已保存到 .lb-info.json');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ 配置失败:', error.message);
    console.error('');
    process.exit(1);
  }
}

main().catch(console.error);
