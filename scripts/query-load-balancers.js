#!/usr/bin/env node
/**
 * 查询阿里云负载均衡资源
 * 支持 CLB (传统型) 和 ALB (应用型)
 */

import https from 'https';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// 从 .env.local 读取配置
const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID;
const ACCESS_KEY_SECRET = process.env.ACCESS_KEY_SECRET;

// 阿里云 API 签名函数
function signRequest(method, path, params, secret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const stringToSign = `${method}&${encodeURIComponent(path)}&${encodeURIComponent(sortedParams)}`;
  const signature = crypto
    .createHmac('sha1', secret + '&')
    .update(stringToSign)
    .digest('base64');

  return signature;
}

// 发送 API 请求
function apiRequest(hostname, action, params, version = '2014-05-15') {
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
            reject(new Error(result.Message || result.Code));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// 查询 CLB (传统型负载均衡)
async function queryCLB() {
  const regions = ['cn-shanghai', 'cn-hangzhou', 'cn-beijing'];

  console.log('🔍 查询传统型负载均衡 (CLB)...');

  for (const region of regions) {
    try {
      const result = await apiRequest(
        'slb.aliyuncs.com',
        'DescribeLoadBalancers',
        { RegionId: region, PageSize: 50 }
      );

      if (result.LoadBalancers && result.LoadBalancers.LoadBalancer) {
        const balancers = Array.isArray(result.LoadBalancers.LoadBalancer)
          ? result.LoadBalancers.LoadBalancer
          : [result.LoadBalancers.LoadBalancer];

        if (balancers.length > 0) {
          console.log(`\n✅ 找到 ${balancers.length} 个 CLB 实例 (区域: ${region}):`);
          balancers.forEach((lb, idx) => {
            console.log(`  ${idx + 1}. ${lb.LoadBalancerName || lb.LoadBalancerId}`);
            console.log(`     ID: ${lb.LoadBalancerId}`);
            console.log(`     地址: ${lb.Address}`);
            console.log(`     状态: ${lb.LoadBalancerStatus}`);
            console.log(`     类型: ${lb.AddressType} (内网/公网)`);
            console.log(`     监听端口: ${lb.ListenerPorts && lb.ListenerPorts.ListenerPort ? lb.ListenerPorts.ListenerPort.join(', ') : '未配置'}`);
            console.log('');
          });
          return balancers;
        }
      }
    } catch (error) {
      // 忽略区域错误，继续查询其他区域
    }
  }

  console.log('⚠️  未找到 CLB 实例');
  return [];
}

// 查询 ALB (应用型负载均衡)
async function queryALB() {
  const regions = ['cn-shanghai', 'cn-hangzhou', 'cn-beijing'];

  console.log('🔍 查询应用型负载均衡 (ALB)...');

  for (const region of regions) {
    try {
      const result = await apiRequest(
        'alb.aliyuncs.com',
        'ListLoadBalancers',
        { RegionId: region, MaxResults: 50 },
        '2020-06-16'
      );

      if (result.LoadBalancers) {
        const balancers = Array.isArray(result.LoadBalancers)
          ? result.LoadBalancers
          : (result.LoadBalancers ? [result.LoadBalancers] : []);

        if (balancers.length > 0) {
          console.log(`\n✅ 找到 ${balancers.length} 个 ALB 实例 (区域: ${region}):`);
          balancers.forEach((lb, idx) => {
            console.log(`  ${idx + 1}. ${lb.LoadBalancerName}`);
            console.log(`     ID: ${lb.LoadBalancerId}`);
            console.log(`     DNS: ${lb.DNSName}`);
            console.log(`     状态: ${lb.Status}`);
            console.log(`     类型: ${lb.AddressType || '公网'}`);
            console.log(`     IP 版本: ${lb.IPv6Enabled ? 'IPv6' : 'IPv4'}`);
            console.log('');
          });
          return balancers;
        }
      }
    } catch (error) {
      // 忽略区域错误
    }
  }

  console.log('⚠️  未找到 ALB 实例');
  return [];
}

// 查询 ECS 实例 (用于后端服务器)
async function queryECS() {
  const regions = ['cn-shanghai'];

  console.log('🔍 查询 ECS 实例...');

  for (const region of regions) {
    try {
      const result = await apiRequest(
        `ecs.${region}.aliyuncs.com`,
        'DescribeInstances',
        { RegionId: region, PageSize: 50 }
      );

      if (result.Instances && result.Instances.Instance) {
        const instances = Array.isArray(result.Instances.Instance)
          ? result.Instances.Instance
          : [result.Instances.Instance];

        console.log(`\n✅ 找到 ${instances.length} 个 ECS 实例 (区域: ${region}):`);
        instances.forEach((inst, idx) => {
          const privateIp = inst.VpcAttributes?.PrivateIpAddress?.IpAddress
            ? (Array.isArray(inst.VpcAttributes.PrivateIpAddress.IpAddress)
                ? inst.VpcAttributes.PrivateIpAddress.IpAddress[0]
                : inst.VpcAttributes.PrivateIpAddress.IpAddress)
            : '无内网IP';
          const publicIp = inst.PublicIpAddress?.IpAddress
            ? (Array.isArray(inst.PublicIpAddress.IpAddress)
                ? inst.PublicIpAddress.IpAddress[0]
                : inst.PublicIpAddress.IpAddress)
            : '无公网IP';

          console.log(`  ${idx + 1}. ${inst.InstanceName || inst.InstanceId}`);
          console.log(`     ID: ${inst.InstanceId}`);
          console.log(`     内网IP: ${privateIp}`);
          console.log(`     公网IP: ${publicIp}`);
          console.log(`     状态: ${inst.Status}`);
          console.log('');
        });
        return instances;
      }
    } catch (error) {
      // 忽略错误
    }
  }

  return [];
}

// 主函数
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║      阿里云负载均衡资源查询          ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  const [clbInstances, albInstances, ecsInstances] = await Promise.all([
    queryCLB(),
    queryALB(),
    queryECS(),
  ]);

  // 输出配置建议
  console.log('╔══════════════════════════════════════╗');
  console.log('║           配置建议                   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  const allLB = [...clbInstances, ...albInstances];

  if (allLB.length > 0) {
    const lb = allLB[0];
    console.log('✅ 推荐配置:');
    console.log(`   LB_TYPE=${clbInstances.length > 0 ? 'CLB' : 'ALB'}`);
    console.log(`   LB_ID=${lb.LoadBalancerId}`);
    console.log(`   LB_ADDRESS=${lb.Address || lb.DNSName}`);
    console.log('');

    if (ecsInstances.length > 0) {
      const ecs = ecsInstances[0];
      const privateIp = ecs.VpcAttributes?.PrivateIpAddress?.IpAddress
        ? (Array.isArray(ecs.VpcAttributes.PrivateIpAddress.IpAddress)
            ? ecs.VpcAttributes.PrivateIpAddress.IpAddress[0]
            : ecs.VpcAttributes.PrivateIpAddress.IpAddress)
        : null;
      console.log(`   后端服务器: ${ecs.InstanceId}`);
      console.log(`   后端IP: ${privateIp || '无内网IP'}`);
      console.log('');
    }
  } else {
    console.log('⚠️  未找到负载均衡实例，请先创建：');
    console.log('   1. 访问阿里云控制台 > 负载均衡');
    console.log('   2. 创建实例 (推荐 CLB 或 ALB)');
    console.log('   3. 配置监听 (HTTP:80, HTTPS:443)');
    console.log('   4. 添加后端服务器 (ECS 实例)');
    console.log('');
  }

  console.log('💡 后续步骤:');
  console.log('   1. 配置负载均衡监听端口');
  console.log('   2. 添加后端 ECS 服务器组');
  console.log('   3. 配置健康检查');
  console.log('   4. (可选) 配置 SSL 证书');
  console.log('');

  return {
    clb: clbInstances,
    alb: albInstances,
    ecs: ecsInstances,
  };
}

main().catch(console.error);
