#!/usr/bin/env node
/**
 * 自动配置 DNS - 非交互版本
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
const ALB_DNS = 'alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com';
const DOMAIN_NAME = 'picshare.com.cn';

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

async function addDNSRecord(domainName, recordType, rr, value) {
  try {
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
  } catch (error) {
    if (error.message.includes('DomainRecordDuplicate')) {
      console.log(`⚠️  记录已存在: ${rr}.${domainName}`);
      return null;
    }
    throw error;
  }
}

async function listDNSRecords(domainName) {
  try {
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
  } catch (error) {
    throw new Error(`查询 DNS 记录失败: ${error.message}`);
  }
}

async function deleteDNSRecord(recordId) {
  try {
    await apiRequest(
      'alidns.aliyuncs.com',
      'DeleteDomainRecord',
      {
        RecordId: recordId,
      }
    );
    console.log(`✅ 已删除旧记录: ${recordId}`);
  } catch (error) {
    console.log(`⚠️  删除记录失败: ${error.message}`);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║       自动配置 DNS 到 ALB            ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log(`域名: ${DOMAIN_NAME}`);
  console.log(`ALB: ${ALB_DNS}`);
  console.log('');

  try {
    // 1. 查询现有记录
    console.log('🔍 查询现有 DNS 记录...');
    const existingRecords = await listDNSRecords(DOMAIN_NAME);

    const wwwRecord = existingRecords.find(r => r.RR.toLowerCase() === 'www' && r.Type === 'CNAME');

    console.log('');

    // 2. 更新 www 记录
    console.log('🔄 配置 www 记录...');
    if (wwwRecord) {
      console.log(`   当前值: ${wwwRecord.Value}`);
      console.log(`   删除旧记录...`);
      await deleteDNSRecord(wwwRecord.RecordId);
      await sleep(2000);
    }

    console.log(`   添加新记录: www.${DOMAIN_NAME} → ${ALB_DNS}`);
    await addDNSRecord(DOMAIN_NAME, 'CNAME', 'www', ALB_DNS);

    console.log('');

    // 完成
    console.log('╔══════════════════════════════════════╗');
    console.log('║           ✅ DNS 配置完成！          ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    console.log('📋 配置信息:');
    console.log(`   域名: www.${DOMAIN_NAME}`);
    console.log(`   类型: CNAME`);
    console.log(`   指向: ${ALB_DNS}`);
    console.log(`   TTL: 600 秒`);
    console.log('');

    console.log('💡 DNS 生效时间:');
    console.log('   • 通常: 5-10 分钟');
    console.log('   • 最长: 24 小时');
    console.log('');

    console.log('🔍 验证命令:');
    console.log(`   nslookup www.${DOMAIN_NAME}`);
    console.log(`   curl -I http://www.${DOMAIN_NAME}`);
    console.log('');

    console.log('🌐 访问地址:');
    console.log(`   http://www.${DOMAIN_NAME}`);
    console.log(`   http://${DOMAIN_NAME} (需要单独配置根域名)`);
    console.log('');

    // 保存配置
    const configPath = path.join(process.cwd(), '.dns-config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        domainName: DOMAIN_NAME,
        albDns: ALB_DNS,
        recordType: 'CNAME',
        configuredAt: new Date().toISOString(),
        records: {
          www: true,
        },
      }, null, 2)
    );
    console.log('✅ 配置已保存到 .dns-config.json');
    console.log('');

    console.log('📝 注意事项:');
    console.log('   • 根域名 (@) 保留了 MX 记录（邮件服务）');
    console.log('   • 如需配置根域名，请手动在阿里云 DNS 控制台添加');
    console.log('   • 或者使用 URL 转发将根域名转发到 www');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ 配置失败:', error.message);
    console.error('');
    process.exit(1);
  }
}

main().catch(console.error);
