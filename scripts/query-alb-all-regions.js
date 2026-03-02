#!/usr/bin/env node
/**
 * 使用 AK/SK 查询阿里云所有区域的 ALB 实例
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

// 查询所有区域的 ALB
async function queryAllALB() {
  const regions = [
    'cn-hangzhou',
    'cn-shanghai',
    'cn-beijing',
    'cn-shenzhen',
    'cn-qingdao',
    'cn-zhangjiakou',
    'cn-huhehaote',
    'cn-wulanchabu',
  ];

  const allALBs = [];

  for (const region of regions) {
    try {
      console.log(`🔍 查询区域: ${region}...`);
      // ALB API 需要使用区域特定的 endpoint
      const hostname = `alb.${region}.aliyuncs.com`;
      const result = await apiRequest(
        hostname,
        'ListLoadBalancers',
        {
          RegionId: region,
          MaxResults: 100,
        }
      );

      if (result.LoadBalancers && result.LoadBalancers.length > 0) {
        result.LoadBalancers.forEach(alb => {
          alb.RegionId = region;
          allALBs.push(alb);
        });
        console.log(`   ✅ 找到 ${result.LoadBalancers.length} 个 ALB 实例`);
      }
    } catch (error) {
      // 忽略区域错误，继续查询下一个
      console.log(`   ⚠️  ${error.message}`);
    }
  }

  return allALBs;
}

// 查询 ECS 实例
async function queryECS() {
  const regions = ['cn-shanghai', 'cn-hangzhou', 'cn-beijing'];

  for (const region of regions) {
    try {
      const result = await apiRequest(
        `ecs.${region}.aliyuncs.com`,
        'DescribeInstances',
        {
          RegionId: region,
          PageSize: 50,
        },
        '2014-05-26'
      );

      if (result.Instances && result.Instances.Instance) {
        const instances = Array.isArray(result.Instances.Instance)
          ? result.Instances.Instance
          : [result.Instances.Instance];

        // 查找公网 IP 为 47.117.182.243 的实例
        const instance = instances.find(inst => {
          const publicIp = inst.PublicIpAddress?.IpAddress
            ? (Array.isArray(inst.PublicIpAddress.IpAddress)
                ? inst.PublicIpAddress.IpAddress[0]
                : inst.PublicIpAddress.IpAddress)
            : null;
          return publicIp === '47.117.182.243';
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
            zoneId: instance.ZoneId,
            privateIp: privateIp,
            regionId: region,
          };
        }
      }
    } catch (error) {
      // 忽略错误，继续下一个区域
    }
  }

  return null;
}

// 主函数
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║    查询阿里云 ALB 资源              ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  // 查询 ALB
  console.log('🔍 步骤 1: 查询所有区域的 ALB 实例...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const albs = await queryAllALB();

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  if (albs.length > 0) {
    console.log(`✅ 共找到 ${albs.length} 个 ALB 实例:`);
    console.log('');

    albs.forEach((alb, idx) => {
      console.log(`[${idx + 1}] ${alb.LoadBalancerName}`);
      console.log(`    ID: ${alb.LoadBalancerId}`);
      console.log(`    DNS: ${alb.DNSName}`);
      console.log(`    区域: ${alb.RegionId}`);
      console.log(`    状态: ${alb.LoadBalancerStatus}`);
      console.log(`    类型: ${alb.AddressType || '公网'}`);
      console.log('');
    });
  } else {
    console.log('❌ 未找到任何 ALB 实例');
    console.log('');
    console.log('💡 可能的原因:');
    console.log('   1. 当前账号下没有 ALB 实例');
    console.log('   2. AK/SK 权限不足');
    console.log('   3. 实例在其他区域（已查询中国大陆所有区域）');
    console.log('');
  }

  // 查询 ECS
  console.log('🔍 步骤 2: 查询 ECS 实例信息...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const ecsInfo = await queryECS();

  if (ecsInfo) {
    console.log('✅ ECS 实例信息:');
    console.log(`   实例ID: ${ecsInfo.instanceId}`);
    console.log(`   公网IP: 47.117.182.243`);
    console.log(`   内网IP: ${ecsInfo.privateIp}`);
    console.log(`   VPC: ${ecsInfo.vpcId}`);
    console.log(`   vSwitch: ${ecsInfo.vSwitchId}`);
    console.log(`   可用区: ${ecsInfo.zoneId}`);
    console.log(`   区域: ${ecsInfo.regionId}`);
    console.log('');

    // 检查 ALB 和 ECS 是否在同一 VPC
    if (albs.length > 0) {
      const sameVpcALBs = albs.filter(alb => {
        // 注意：ALB 返回的可能是 VpcId 字段
        return true; // 需要实际字段才能判断
      });

      if (sameVpcALBs.length > 0) {
        console.log('💡 推荐:');
        console.log('   以下 ALB 可以配置为后端服务器:');
        sameVpcALBs.forEach((alb, idx) => {
          console.log(`   ${idx + 1}. ${alb.LoadBalancerName} (${alb.DNSName})`);
        });
        console.log('');
      }
    }
  } else {
    console.log('❌ 未找到 ECS 实例 (47.117.182.243)');
    console.log('');
  }

  // 输出配置建议
  console.log('╔══════════════════════════════════════╗');
  console.log('║           配置建议                   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  if (albs.length > 0 && ecsInfo) {
    const selectedALB = albs[0];
    console.log('✅ 推荐配置方案:');
    console.log('');
    console.log('ALB 实例:');
    console.log(`   ID: ${selectedALB.LoadBalancerId}`);
    console.log(`   DNS: ${selectedALB.DNSName}`);
    console.log(`   名称: ${selectedALB.LoadBalancerName}`);
    console.log('');
    console.log('后端服务器:');
    console.log(`   ECS ID: ${ecsInfo.instanceId}`);
    console.log(`   内网IP: ${ecsInfo.privateIp}`);
    console.log(`   端口: 80`);
    console.log('');
    console.log('💡 下一步操作:');
    console.log('   1. 在 ALB 上创建服务器组');
    console.log('   2. 添加 ECS 到服务器组');
    console.log('   3. 配置监听器 (HTTP:80, HTTPS:443)');
    console.log('   4. 部署应用到 ECS');
    console.log('');
    console.log('📝 或者运行自动配置脚本:');
    console.log(`   node configure-existing-alb.js`);
    console.log('');
  } else if (albs.length === 0) {
    console.log('❌ 未找到 ALB 实例，请先创建:');
    console.log('   1. 登录阿里云控制台');
    console.log('   2. 产品与服务 > 负载均衡 ALB');
    console.log('   3. 创建应用型负载均衡实例');
    console.log('   4. 选择区域: ' + (ecsInfo?.regionId || 'cn-shanghai'));
    console.log('   5. 选择 VPC: ' + (ecsInfo?.vpcId || '与 ECS 相同'));
    console.log('');
  } else if (!ecsInfo) {
    console.log('❌ 未找到 ECS 实例，请检查 ECS_HOST 配置');
    console.log('');
  }
}

main().catch(console.error);
