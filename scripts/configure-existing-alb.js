#!/usr/bin/env node
/**
 * 配置现有的阿里云 ALB 实例
 * 添加后端服务器组、监听器、健康检查等
 */

import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从 .env.deploy 读取配置
function loadEnvConfig() {
  const envPath = path.join(__dirname, '.env.deploy');
  if (!fs.existsSync(envPath)) {
    console.error('❌ 未找到 .env.deploy 文件');
    process.exit(1);
  }

  const env = {};
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    // 支持两种格式: KEY=value 和 export KEY=value
    const match = line.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (match) {
      env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
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

function apiRequest(hostname, action, params, version = '2020-06-16') {
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

// 获取 ECS 实例信息
async function getECSInfo() {
  try {
    const result = await apiRequest(
      `ecs.${REGION}.aliyuncs.com`,
      'DescribeInstances',
      {
        RegionId: REGION,
        PageSize: 50,
      },
      '2014-05-26'
    );

    if (result.Instances && result.Instances.Instance) {
      const instances = Array.isArray(result.Instances.Instance)
        ? result.Instances.Instance
        : [result.Instances.Instance];

      // 查找匹配公网 IP 的实例
      const instance = instances.find(inst => {
        const publicIp = inst.PublicIpAddress?.IpAddress
          ? (Array.isArray(inst.PublicIpAddress.IpAddress)
              ? inst.PublicIpAddress.IpAddress[0]
              : inst.PublicIpAddress.IpAddress)
          : null;
        return publicIp === ECS_HOST;
      });

      if (instance) {
        const privateIp = instance.VpcAttributes?.PrivateIpAddress?.IpAddress
          ? (Array.isArray(instance.VpcAttributes.PrivateIpAddress.IpAddress)
              ? instance.VpcAttributes.PrivateIpAddress.IpAddress[0]
              : instance.VpcAttributes.PrivateIpAddress.IpAddress)
          : null;

        return {
          instanceId: instance.InstanceId,
          vpcId: instance.VpcAttributes.VpcId,
          vSwitchId: instance.VpcAttributes.VSwitchId,
          privateIp: privateIp,
          zoneId: instance.ZoneId,
        };
      }
    }

    throw new Error('未找到匹配的 ECS 实例');
  } catch (error) {
    throw new Error(`获取 ECS 信息失败: ${error.message}`);
  }
}

// 列出 ALB 实例
async function listALBs() {
  try {
    // ALB 需要使用区域特定的 endpoint
    const hostname = `alb.${REGION}.aliyuncs.com`;
    const result = await apiRequest(
      hostname,
      'ListLoadBalancers',
      {
        RegionId: REGION,
        MaxResults: 50,
      }
    );

    if (result.LoadBalancers && result.LoadBalancers.length > 0) {
      return result.LoadBalancers;
    }

    return [];
  } catch (error) {
    throw new Error(`查询 ALB 失败: ${error.message}`);
  }
}

// 创建服务器组
async function createServerGroup(albId, vpcId, ecsInfo) {
  console.log('📦 创建服务器组...');

  try {
    const hostname = `alb.${REGION}.aliyuncs.com`;

    const result = await apiRequest(
      hostname,
      'CreateServerGroup',
      {
        RegionId: REGION,
        ServerGroupName: 'picshare-backend-group-' + Date.now(),
        VpcId: vpcId,
        Protocol: 'HTTP',
        Scheduler: 'Wrr',
        // 健康检查配置（扁平格式）
        'HealthCheckConfig.HealthCheckEnabled': 'true',
        'HealthCheckConfig.HealthCheckProtocol': 'HTTP',
        'HealthCheckConfig.HealthCheckPath': '/health',
        'HealthCheckConfig.HealthCheckTimeout': '5',
        'HealthCheckConfig.HealthCheckInterval': '10',
        'HealthCheckConfig.HealthyThreshold': '3',
        'HealthCheckConfig.UnhealthyThreshold': '3',
        'HealthCheckConfig.HealthCheckHttpCodes.1': 'http_2xx',
        // 会话保持配置（扁平格式）
        'StickySessionConfig.StickySessionEnabled': 'false',
        'StickySessionConfig.StickySessionType': 'Insert',
      }
    );

    console.log('✅ 服务器组创建成功!');
    console.log(`   ID: ${result.ServerGroupId}`);

    return result.ServerGroupId;
  } catch (error) {
    throw new Error(`创建服务器组失败: ${error.message}`);
  }
}

// 等待服务器组就绪
async function waitForServerGroupReady(serverGroupId) {
  console.log('⏳ 等待服务器组就绪...');

  const maxAttempts = 30; // 最多等待 30 次 (30 秒)
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const hostname = `alb.${REGION}.aliyuncs.com`;
      const result = await apiRequest(
        hostname,
        'GetServerGroup',
        {
          RegionId: REGION,
          ServerGroupId: serverGroupId,
        }
      );

      if (result.ServerGroupStatus === 'Active') {
        console.log('✅ 服务器组已就绪!');
        return true;
      }

      console.log(`   当前状态: ${result.ServerGroupStatus}，等待中... (${i + 1}/${maxAttempts})`);
    } catch (error) {
      // 忽略错误，继续等待
    }

    // 等待 1 秒
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('服务器组在预期时间内未能就绪');
}
async function addServersToGroup(serverGroupId, ecsInfo) {
  console.log('🖥️  添加 ECS 到服务器组...');

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const hostname = `alb.${REGION}.aliyuncs.com`;
      await apiRequest(
        hostname,
        'AddServersToServerGroup',
        {
          RegionId: REGION,
          ServerGroupId: serverGroupId,
          // 使用扁平格式添加服务器
          'Servers.1.ServerType': 'Ecs',
          'Servers.1.ServerId': ecsInfo.instanceId,
          'Servers.1.Port': '80',
          'Servers.1.Weight': '100',
        }
      );

      console.log('✅ ECS 添加成功!');
      console.log(`   实例ID: ${ecsInfo.instanceId}`);
      console.log(`   内网IP: ${ecsInfo.privateIp}`);
      console.log(`   端口: 80`);
      console.log(`   权重: 100`);
      return;
    } catch (error) {
      if (attempt < maxAttempts && error.message.includes('IncorrectStatus')) {
        console.log(`   服务器组未就绪，等待 3 秒后重试 (${attempt}/${maxAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      throw new Error(`添加服务器失败: ${error.message}`);
    }
  }
}

// 创建监听器
async function createListener(albId, serverGroupId) {
  console.log('🔌 创建 HTTP 监听器 (端口: 80)...');

  try {
    const hostname = `alb.${REGION}.aliyuncs.com`;
    const result = await apiRequest(
      hostname,
      'CreateListener',
      {
        RegionId: REGION,
        LoadBalancerId: albId,
        ListenerProtocol: 'HTTP',
        ListenerPort: '80',
        ListenerDescription: 'PicShare HTTP Listener',
        // 使用扁平格式配置转发规则
        'DefaultActions.1.Type': 'ForwardGroup',
        'DefaultActions.1.ForwardGroupConfig.ServerGroupTuples.1.ServerGroupId': serverGroupId,
      }
    );

    console.log('✅ HTTP 监听器创建成功!');
    console.log(`   ID: ${result.ListenerId}`);
    console.log(`   端口: 80`);

    return result.ListenerId;
  } catch (error) {
    throw new Error(`创建监听器失败: ${error.message}`);
  }
}

// 交互式输入
function question(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

// 主函数
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║      配置现有 ALB 实例               ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  try {
    // 1. 查询 ALB 实例
    console.log('🔍 步骤 1: 查询 ALB 实例...');
    const albs = await listALBs();

    if (albs.length === 0) {
      console.log('❌ 未找到 ALB 实例');
      console.log('');
      console.log('💡 请先在阿里云控制台创建 ALB 实例:');
      console.log('   1. 登录阿里云控制台');
      console.log('   2. 产品与服务 > 负载均衡 > 应用型负载均衡 ALB');
      console.log('   3. 创建实例');
      console.log('');
      process.exit(1);
    }

    console.log(`✅ 找到 ${albs.length} 个 ALB 实例:`);
    albs.forEach((alb, idx) => {
      console.log(`  ${idx + 1}. ${alb.LoadBalancerName}`);
      console.log(`     ID: ${alb.LoadBalancerId}`);
      console.log(`     DNS: ${alb.DNSName}`);
      console.log(`     状态: ${alb.LoadBalancerStatus}`);
      console.log('');
    });

    // 2. 选择 ALB
    let selectedALB;
    if (albs.length === 1) {
      selectedALB = albs[0];
      console.log(`✅ 自动选择: ${selectedALB.LoadBalancerName}`);
    } else {
      const choice = await question(`请选择 ALB 实例 [1-${albs.length}]: `);
      const index = parseInt(choice) - 1;
      if (index < 0 || index >= albs.length) {
        console.log('❌ 无效选择');
        process.exit(1);
      }
      selectedALB = albs[index];
    }

    console.log('');

    // 3. 获取 ECS 信息
    console.log('🔍 步骤 2: 获取 ECS 实例信息...');
    const ecsInfo = await getECSInfo();
    console.log('✅ ECS 信息获取成功!');
    console.log(`   实例ID: ${ecsInfo.instanceId}`);
    console.log(`   VPC: ${ecsInfo.vpcId}`);
    console.log(`   内网IP: ${ecsInfo.privateIp}`);
    console.log('');

    // 4. 创建服务器组
    console.log('🔍 步骤 3: 创建服务器组...');
    const serverGroupId = await createServerGroup(
      selectedALB.LoadBalancerId,
      ecsInfo.vpcId,
      ecsInfo
    );
    console.log('');

    // 5. 等待服务器组就绪
    console.log('🔍 步骤 4: 等待服务器组就绪...');
    await waitForServerGroupReady(serverGroupId);
    console.log('');

    // 6. 添加 ECS 到服务器组
    console.log('🔍 步骤 5: 添加后端服务器...');
    await addServersToGroup(serverGroupId, ecsInfo);
    console.log('');

    // 7. 创建监听器
    console.log('🔍 步骤 6: 创建监听器...');
    const listenerId = await createListener(selectedALB.LoadBalancerId, serverGroupId);
    console.log('');

    // 7. 保存配置
    console.log('╔══════════════════════════════════════╗');
    console.log('║           配置完成！                  ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
    console.log('✅ ALB 配置成功!');
    console.log('');
    console.log('📋 配置信息:');
    console.log(`   ALB ID: ${selectedALB.LoadBalancerId}`);
    console.log(`   ALB 名称: ${selectedALB.LoadBalancerName}`);
    console.log(`   ALB DNS: ${selectedALB.DNSName}`);
    console.log(`   服务器组 ID: ${serverGroupId}`);
    console.log(`   监听器 ID: ${listenerId}`);
    console.log('');

    // 更新 .env.deploy
    const envPath = path.join(__dirname, '.env.deploy');
    let content = fs.readFileSync(envPath, 'utf-8');

    if (!content.includes('LB_ADDRESS')) {
      content += `\n# 负载均衡配置\nexport LB_ADDRESS=${selectedALB.DNSName}\n`;
      content += `export LB_ID=${selectedALB.LoadBalancerId}\n`;
      content += `export LB_TYPE=ALB\n`;
      content += `export USE_LB=true\n`;
      fs.writeFileSync(envPath, content);
      console.log('✅ 已更新 .env.deploy 文件');
      console.log('');
    }

    // 保存详细信息
    const albInfoPath = path.join(__dirname, '.lb-info.json');
    fs.writeFileSync(
      albInfoPath,
      JSON.stringify(
        {
          type: 'ALB',
          id: selectedALB.LoadBalancerId,
          name: selectedALB.LoadBalancerName,
          dnsName: selectedALB.DNSName,
          serverGroupId: serverGroupId,
          listenerId: listenerId,
          ecsInstanceId: ecsInfo.instanceId,
          createdAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
    console.log('✅ 已保存配置到 .lb-info.json');
    console.log('');

    console.log('💡 下一步:');
    console.log('   1. 部署应用到 ECS: bash deploy-remote.sh');
    console.log(`   2. 配置域名 DNS CNAME 到: ${selectedALB.DNSName}`);
    console.log('   3. (可选) 配置 HTTPS 监听器');
    console.log(`   4. 测试访问: curl http://${selectedALB.DNSName}/health`);
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ 配置失败:', error.message);
    console.error('');
    process.exit(1);
  }
}

main().catch(console.error);
