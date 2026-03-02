#!/usr/bin/env node
/**
 * 修正 DNS 配置 - 前端指向 CDN，API 指向 ALB
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
const DOMAIN_NAME = 'picshare.com.cn';
const CDN_CNAME = 'www.picshare.com.cn.w.kunlunaq.com';
const ALB_DNS = 'alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com';

function signRequest(method, path, params, secret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const stringToSign = `${method}&${encodeURIComponent(path)}&${encodeURIComponent(sortedParams)}`;
  return crypto.createHmac('sha1', secret + '&').update(stringToSign).digest('base64');
}

function apiRequest(hostname, action, params, version = '2015-01-09') {
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function listDNSRecords(domainName) {
  const result = await apiRequest(
    'alidns.aliyuncs.com',
    'DescribeDomainRecords',
    {
      DomainName: domainName,
      PageSize: 500,
    }
  );

  if (result.DomainRecords) {
    const records = result.DomainRecords.Record || [];
    return Array.isArray(records) ? records : [records];
  }

  return [];
}

async function deleteDNSRecord(recordId) {
  await apiRequest(
    'alidns.aliyuncs.com',
    'DeleteDomainRecord',
    {
      RecordId: recordId,
    }
  );
  console.log(`✅ 已删除旧记录: ${recordId}`);
}

async function addDNSRecord(domainName, recordType, rr, value) {
  const result = await apiRequest(
    'alidns.aliyuncs.com',
    'AddDomainRecord',
    {
      DomainName: domainName,
      Type: recordType,
      RR: rr,
      Value: value,
      TTL: '600',
    }
  );

  console.log(`✅ DNS 记录添加成功: ${rr}.${domainName} → ${value}`);
  return result.RecordId;
}

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║       修正 DNS 配置                  ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('目标架构:');
  console.log('  • www.picshare.com.cn → CDN (前端静态文件)');
  console.log('  • api.picshare.com.cn → ALB (API 接口)');
  console.log('');

  try {
    // 1. 查询现有记录
    console.log('🔍 步骤 1/3: 查询现有 DNS 记录...');
    const records = await listDNSRecords(DOMAIN_NAME);

    const wwwRecord = records.find(r => r.RR.toLowerCase() === 'www' && r.Type === 'CNAME');
    const apiRecord = records.find(r => r.RR.toLowerCase() === 'api' && r.Type === 'CNAME');

    console.log('');

    // 2. 更新 www 记录指向 CDN
    console.log('🔄 步骤 2/3: 配置 www 指向 CDN...');
    if (wwwRecord) {
      console.log(`   当前值: ${wwwRecord.Value}`);
      if (wwwRecord.Value !== CDN_CNAME) {
        console.log(`   删除旧记录...`);
        await deleteDNSRecord(wwwRecord.RecordId);
        await sleep(2000);
        console.log(`   添加新记录: www → CDN`);
        await addDNSRecord(DOMAIN_NAME, 'CNAME', 'www', CDN_CNAME);
      } else {
        console.log(`   ✅ 已经指向 CDN，无需修改`);
      }
    } else {
      console.log(`   添加新记录: www → CDN`);
      await addDNSRecord(DOMAIN_NAME, 'CNAME', 'www', CDN_CNAME);
    }

    console.log('');

    // 3. 添加 api 记录指向 ALB
    console.log('🔄 步骤 3/3: 配置 api 指向 ALB...');
    if (apiRecord) {
      console.log(`   当前值: ${apiRecord.Value}`);
      if (apiRecord.Value !== ALB_DNS) {
        console.log(`   删除旧记录...`);
        await deleteDNSRecord(apiRecord.RecordId);
        await sleep(2000);
        console.log(`   添加新记录: api → ALB`);
        await addDNSRecord(DOMAIN_NAME, 'CNAME', 'api', ALB_DNS);
      } else {
        console.log(`   ✅ 已经指向 ALB，无需修改`);
      }
    } else {
      console.log(`   添加新记录: api → ALB`);
      await addDNSRecord(DOMAIN_NAME, 'CNAME', 'api', ALB_DNS);
    }

    console.log('');

    // 完成
    console.log('╔══════════════════════════════════════╗');
    console.log('║           ✅ DNS 配置完成！          ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    console.log('📋 新的架构:');
    console.log('  • 前端: www.picshare.com.cn → CDN');
    console.log('  • API:  api.picshare.com.cn → ALB');
    console.log('');

    console.log('⚠️  重要: 需要更新前端配置');
    console.log('');
    console.log('修改前端 API 地址:');
    console.log('  旧: http://www.picshare.com.cn/api');
    console.log('  新: http://api.picshare.com.cn');
    console.log('');

    console.log('💡 DNS 生效时间: 5-10 分钟');
    console.log('');

    console.log('🔍 验证命令:');
    console.log('  nslookup www.picshare.com.cn  # 应该指向 CDN');
    console.log('  nslookup api.picshare.com.cn  # 应该指向 ALB');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ 配置失败:', error.message);
    console.error('');
    process.exit(1);
  }
}

main().catch(console.error);
