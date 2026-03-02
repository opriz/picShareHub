#!/usr/bin/env node
/**
 * 创建和配置阿里云负载均衡
 * 支持 CLB (传统型) 和 ALB (应用型)
 */

import https from 'https';
import crypto from 'crypto';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从 .env.deploy 读取配置
function loadEnvConfig() {
  const envPath = path.join(__dirname, '.env.deploy');
  if (!fs.existsSync(envPath)) {
    console.error('❌ 未找到 .env.deploy 文件，请先创建配置文件');
    process.exit(1);
  }

  const env = {};
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const match = line.match(/^export\s+([^=]+)=(.+)$/);
    if (match) {
      env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  });

  return env;
}

const env = loadEnvConfig();
const ACCESS_KEY_ID = env.ALIYUN_AK;
const ACCESS_KEY_SECRET = env.ALIYUN_SK;
const ECS_HOST = env.ECS_HOST;
const REGION = env.ECS_REGION || 'cn-shanghai';

// 阿里云 API 签名
function signRequest(method, path, params, secret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const stringToSign = `${method}&${encodeURIComponent(path)}&${encodeURIComponent(sortedParams)}`;
  return crypto.createHmac('sha1', secret + '&').update(stringToSign).digest('base64');
}

function apiRequest(hostname, action, params, version = '2014-05-15', method = 'GET') {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const requestParams = {
      Format: 'JSON',
      Version: version,
      AccessKeyId: ACCESS_KEY_ID,
      SignatureMethod: 'HMAC-SHA1',
      Timestamp: timestamp,
      SignatureVersion: '1.0',
      SignatureNonce: Math.random().toString(36).substring(7),
      Action: action,
      ...params,
    };

    const signature = signRequest(method, '/', requestParams, ACCESS_KEY_SECRET);
    requestParams.Signature = signature;

    let queryString = Object.keys(requestParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(requestParams[key])}`)
      .join('&');

    const options = {
      hostname: hostname,
      path: method === 'POST' ? '/' : `/?${queryString}`,
      method: method,
    };

    if (method === 'POST') {
      options.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
    }

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

    if (method === 'POST') {
      req.write(queryString);
    }
    req.end();
  });
}

// 获取 ECS 实例的 VPC ID 和内网 IP
async function getECSInfo() {
  try {
    const result = await apiRequest(
      `ecs.${REGION}.aliyuncs.com`,
      'DescribeInstances',
      {
        RegionId: REGION,
        InstanceIds: JSON.stringify([await getECSInstanceId()]),
      }
    );

    if (result.Instances && result.Instances.Instance) {
      const instance = Array.isArray(result.Instances.Instance)
        ? result.Instances.Instance[0]
        : result.Instances.Instance;

      return {
        instanceId: instance.InstanceId,
        vpcId: instance.VpcAttributes.VpcId,
        vSwitchId: instance.VpcAttributes.VSwitchId,
        privateIp: instance.VpcAttributes.PrivateIpAddress.IpAddress
          ? (Array.isArray(instance.VpcAttributes.PrivateIpAddress.IpAddress)
              ? instance.VpcAttributes.PrivateIpAddress.IpAddress[0]
              : instance.VpcAttributes.PrivateIpAddress.IpAddress)
          : null,
        zoneId: instance.ZoneId,
      };
    }
  } catch (error) {
    throw new Error(`获取 ECS 信息失败: ${error.message}`);
  }
}

// 通过公网IP获取实例ID
async function getECSInstanceId() {
  try {
    const result = await apiRequest(
      `ecs.${REGION}.aliyuncs.com`,
      'DescribeInstances',
      {
        RegionId: REGION,
        PublicIpAddress: [ECS_HOST],
      }
    );

    if (result.Instances && result.Instances.Instance) {
      const instance = Array.isArray(result.Instances.Instance)
        ? result.Instances.Instance[0]
        : result.Instances.Instance;
      return instance.InstanceId;
    }
  } catch (error) {
    throw new Error(`通过公网IP查找实例失败: ${error.message}`);
  }
}

// 创建 CLB 实例
async function createCLB(ecsInfo) {
  console.log('📦 创建传统型负载均衡 (CLB) 实例...');

  const loadBalancerName = 'picshare-lb-' + Date.now();
  const addressType = 'internet'; // 公网类型

  try {
    const result = await apiRequest(
      'slb.aliyuncs.com',
      'CreateLoadBalancer',
      {
        RegionId: REGION,
        LoadBalancerName: loadBalancerName,
        AddressType: addressType,
        InternetChargeType: 'paybytraffic',
        VpcId: ecsInfo.vpcId,
        VSwitchId: ecsInfo.vSwitchId,
        MasterZoneId: ecsInfo.zoneId,
        SlaveZoneId: ecsInfo.zoneId, // 单区域
      }
    );

    console.log('✅ CLB 实例创建成功!');
    console.log(`   ID: ${result.LoadBalancerId}`);
    console.log(`   地址: ${result.Address}`);

    return {
      type: 'CLB',
      id: result.LoadBalancerId,
      address: result.Address,
      name: loadBalancerName,
    };
  } catch (error) {
    throw new Error(`创建 CLB 失败: ${error.message}`);
  }
}

// 添加后端服务器
async function addBackendServers(lbId, ecsInfo) {
  console.log(`🖥️  添加后端服务器到负载均衡 ${lbId}...`);

  try {
    await apiRequest(
      'slb.aliyuncs.com',
      'AddBackendServers',
      {
        RegionId: REGION,
        LoadBalancerId: lbId,
        BackendServers: JSON.stringify([
          {
            ServerId: ecsInfo.instanceId,
            Port: 80,
            Weight: 100,
          },
        ]),
      }
    );

    console.log('✅ 后端服务器添加成功!');
    console.log(`   实例ID: ${ecsInfo.instanceId}`);
    console.log(`   内网IP: ${ecsInfo.privateIp}`);
    console.log(`   端口: 80`);
    console.log(`   权重: 100`);
  } catch (error) {
    throw new Error(`添加后端服务器失败: ${error.message}`);
  }
}

// 创建 HTTP 监听
async function createHTTPListener(lbId) {
  console.log('🔌 创建 HTTP 监听 (端口: 80)...');

  try {
    await apiRequest(
      'slb.aliyuncs.com',
      'CreateLoadBalancerHTTPListener',
      {
        RegionId: REGION,
        LoadBalancerId: lbId,
        ListenerPort: 80,
        BackendServerPort: 80,
        Bandwidth: -1,
        HealthCheck: 'on',
        HealthCheckURI: '/api/health',
        HealthCheckTimeout: 5,
        HealthCheckInterval: 10,
        HealthyThreshold: 3,
        UnhealthyThreshold: 3,
        StickySession: 'off',
        StickySessionType: 'insert',
      }
    );

    console.log('✅ HTTP 监听创建成功!');
    console.log(`   前端端口: 80`);
    console.log(`   后端端口: 80`);
    console.log(`   健康检查: /api/health`);
  } catch (error) {
    throw new Error(`创建 HTTP 监听失败: ${error.message}`);
  }
}

// 启动负载均衡实例
async function startLoadBalancer(lbId) {
  console.log(`▶️  启动负载均衡实例 ${lbId}...`);

  try {
    await apiRequest(
      'slb.aliyuncs.com',
      'StartLoadBalancerListener',
      {
        RegionId: REGION,
        LoadBalancerId: lbId,
        ListenerPort: 80,
      }
    );

    console.log('✅ 负载均衡实例已启动!');
  } catch (error) {
    console.log(`⚠️  启动负载均衡失败: ${error.message}`);
  }
}

// 更新 DNS 解析
function updateDNSConfig(lbAddress) {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║       DNS 解析配置指南               ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('📝 后续步骤:');
  console.log('   1. 登录阿里云 DNS 控制台');
  console.log(`   2. 添加 A 记录，指向负载均衡地址: ${lbAddress}`);
  console.log('   3. 或者使用 CNAME 记录 (如果需要)');
  console.log('');

  // 更新 .env.deploy
  const envPath = path.join(__dirname, '.env.deploy');
  let content = fs.readFileSync(envPath, 'utf-8');

  if (!content.includes('LB_ADDRESS')) {
    content += `\n# 负载均衡地址\nexport LB_ADDRESS=${lbAddress}\n`;
    fs.writeFileSync(envPath, content);
    console.log(`✅ 已更新 .env.deploy 文件`);
    console.log(`   LB_ADDRESS=${lbAddress}`);
    console.log('');
  }
}

// 生成新的 Nginx 配置（支持 LB 后端）
function generateNginxConfig() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║    Nginx 配置更新指南                ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('📝 ECS 上的 Nginx 需要配置为:');
  console.log('   • 监听 80 端口 (接收来自 LB 的流量)');
  console.log('   • 获取真实 IP (配置 X-Forwarded-For)');
  console.log('   • 静态文件服务');
  console.log('   • API 代理到后端');
  console.log('');
  console.log('💡 部署脚本会自动更新 Nginx 配置');
}

// 主函数
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║      阿里云负载均衡配置工具          ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  try {
    // 1. 获取 ECS 信息
    console.log('🔍 步骤 1: 获取 ECS 实例信息...');
    const ecsInfo = await getECSInfo();
    console.log('✅ ECS 信息获取成功!');
    console.log(`   实例ID: ${ecsInfo.instanceId}`);
    console.log(`   VPC: ${ecsInfo.vpcId}`);
    console.log(`   内网IP: ${ecsInfo.privateIp}`);
    console.log('');

    // 2. 创建 CLB 实例
    console.log('🔍 步骤 2: 创建负载均衡实例...');
    const lb = await createCLB(ecsInfo);
    console.log('');

    // 3. 添加后端服务器
    console.log('🔍 步骤 3: 配置后端服务器...');
    await addBackendServers(lb.id, ecsInfo);
    console.log('');

    // 4. 创建监听器
    console.log('🔍 步骤 4: 配置负载均衡监听器...');
    await createHTTPListener(lb.id);
    console.log('');

    // 5. 启动 LB
    console.log('🔍 步骤 5: 启动负载均衡...');
    await startLoadBalancer(lb.id);
    console.log('');

    // 6. 输出配置信息
    console.log('╔══════════════════════════════════════╗');
    console.log('║           配置完成！                  ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
    console.log('✅ 负载均衡配置成功!');
    console.log('');
    console.log('📋 负载均衡信息:');
    console.log(`   类型: ${lb.type}`);
    console.log(`   ID: ${lb.id}`);
    console.log(`   名称: ${lb.name}`);
    console.log(`   地址: ${lb.address}`);
    console.log('');

    // 7. 更新配置指南
    updateDNSConfig(lb.address);
    generateNginxConfig();

    // 8. 保存 LB 信息到文件
    const lbInfoPath = path.join(__dirname, '.lb-info.json');
    fs.writeFileSync(
      lbInfoPath,
      JSON.stringify(
        {
          type: lb.type,
          id: lb.id,
          address: lb.address,
          name: lb.name,
          ecsInstanceId: ecsInfo.instanceId,
          createdAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
    console.log('✅ 已保存 LB 配置到 .lb-info.json');
    console.log('');

    console.log('💡 下一步:');
    console.log('   1. 更新域名 DNS 解析，指向负载均衡地址');
    console.log('   2. (可选) 配置 HTTPS 监听 (443 端口)');
    console.log('   3. 重新部署应用到 ECS');
    console.log('   4. 测试负载均衡是否工作正常');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ 配置失败:', error.message);
    console.error('');
    console.error('💡 可能的原因:');
    console.error('   1. 账户余额不足');
    console.error('   2. 权限不足');
    console.error('   3. 网络问题');
    console.error('   4. ECS 实例状态异常');
    console.error('');
    process.exit(1);
  }
}

main().catch(console.error);
