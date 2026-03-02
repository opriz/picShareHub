#!/usr/bin/env node
/**
 * 自动配置 DNS 解析到 ALB
 */

import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID;
const ACCESS_KEY_SECRET = process.env.ACCESS_KEY_SECRET;
const ALB_DNS = 'alb-14trlrvmsf59tp8id4.cn-shanghai.alb.aliyuncsslb.com';

// 阿里云 API 签名
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

// 查询域名列表
async function listDomains() {
  try {
    const result = await apiRequest(
      'alidns.aliyuncs.com',
      'DescribeDomains',
      {
        PageSize: 100,
      }
    );

    if (result.Domains && result.Domains.Domain) {
      const domains = Array.isArray(result.Domains.Domain)
        ? result.Domains.Domain
        : [result.Domains.Domain];

      return domains.map(d => ({
        domainId: d.DomainId,
        domainName: d.DomainName,
        punyCode: d.PunyCode,
        dnsServers: d.DnsServers ? d.DnsServers.DnsServer : [],
      }));
    }

    return [];
  } catch (error) {
    throw new Error(`查询域名失败: ${error.message}`);
  }
}

// 添加 DNS 解析记录
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

    console.log('✅ DNS 记录添加成功!');
    console.log(`   记录ID: ${result.RecordId}`);
    console.log(`   类型: ${recordType}`);
    console.log(`   主机记录: ${rr}`);
    console.log(`   记录值: ${value}`);
    console.log(`   TTL: 600`);

    return result.RecordId;
  } catch (error) {
    throw new Error(`添加 DNS 记录失败: ${error.message}`);
  }
}

// 查询现有 DNS 记录
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

// 删除 DNS 记录
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
    throw new Error(`删除 DNS 记录失败: ${error.message}`);
  }
}

// 主函数
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║       自动配置 DNS 解析到 ALB         ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log(`目标 ALB: ${ALB_DNS}`);
  console.log('');

  try {
    // 1. 查询域名列表
    console.log('🔍 步骤 1/4: 查询域名列表...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const domains = await listDomains();

    if (domains.length === 0) {
      console.log('❌ 未找到任何域名');
      console.log('');
      console.log('💡 请先在阿里云购买或添加域名：');
      console.log('   1. 访问 https://dc.console.aliyun.com/next/index');
      console.log('   2. 或访问 https://wanwang.aliyun.com');
      console.log('   3. 购买域名或转入已有域名');
      console.log('');
      process.exit(1);
    }

    console.log(`✅ 找到 ${domains.length} 个域名:`);
    domains.forEach((d, idx) => {
      console.log(`  ${idx + 1}. ${d.domainName}`);
      console.log(`     ID: ${d.domainId}`);
      console.log('');
    });

    // 2. 选择域名
    console.log('🔍 步骤 2/4: 选择要配置的域名');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    let selectedDomain;
    if (domains.length === 1) {
      selectedDomain = domains[0];
      console.log(`✅ 自动选择: ${selectedDomain.domainName}`);
      console.log('');
    } else {
      const choice = await question(`请选择域名 [1-${domains.length}]: `);
      const index = parseInt(choice) - 1;
      if (index < 0 || index >= domains.length) {
        console.log('❌ 无效选择');
        process.exit(1);
      }
      selectedDomain = domains[index];
      console.log('');
    }

    // 3. 检查现有记录
    console.log('🔍 步骤 3/4: 检查现有 DNS 记录...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const existingRecords = await listDNSRecords(selectedDomain.domainName);

    // 查找是否已有 @ 或 www 记录
    const rootRecord = existingRecords.find(r => r.RR === '@' || r.RR === '');
    const wwwRecord = existingRecords.find(r => r.RR.toLowerCase() === 'www');

    if (rootRecord) {
      console.log(`⚠️  发现根域名记录 (@):`);
      console.log(`   类型: ${rootRecord.Type}`);
      console.log(`   值: ${rootRecord.Value}`);
      console.log(`   ID: ${rootRecord.RecordId}`);
      console.log('');
    }

    if (wwwRecord) {
      console.log(`⚠️  发现 www 记录:`);
      console.log(`   类型: ${wwwRecord.Type}`);
      console.log(`   值: ${wwwRecord.Value}`);
      console.log(`   ID: ${wwwRecord.RecordId}`);
      console.log('');
    }

    // 询问是否添加记录
    console.log('🔍 步骤 4/4: 添加 DNS 解析记录');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const addRoot = await question('是否添加/更新根域名记录 (@)? [y/N]: ');
    const addWww = await question('是否添加/更新 www 记录? [y/N]: ');

    console.log('');

    // 添加或更新根域名记录
    if (addRoot.toLowerCase() === 'y') {
      if (rootRecord) {
        console.log(`🔄 更新根域名记录 (@)...`);
        await deleteDNSRecord(rootRecord.RecordId);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log(`➕ 添加根域名记录 (@)...`);
      }

      await addDNSRecord(selectedDomain.domainName, 'CNAME', '@', ALB_DNS);
      console.log('');
    }

    // 添加或更新 www 记录
    if (addWww.toLowerCase() === 'y') {
      if (wwwRecord) {
        console.log(`🔄 更新 www 记录...`);
        await deleteDNSRecord(wwwRecord.RecordId);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log(`➕ 添加 www 记录...`);
      }

      await addDNSRecord(selectedDomain.domainName, 'CNAME', 'www', ALB_DNS);
      console.log('');
    }

    // 完成
    console.log('╔══════════════════════════════════════╗');
    console.log('║           ✅ DNS 配置完成！         ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    console.log('📋 配置信息:');
    console.log(`   域名: ${selectedDomain.domainName}`);
    console.log(`   ALB: ${ALB_DNS}`);
    console.log('');

    console.log('💡 DNS 生效时间:');
    console.log('   • 通常: 5-10 分钟');
    console.log('   • 最长: 24 小时');
    console.log('');

    console.log('🔍 验证命令:');
    console.log(`   nslookup ${selectedDomain.domainName}`);
    console.log(`   dig ${selectedDomain.domainName}`);
    console.log(`   ping ${selectedDomain.domainName}`);
    console.log('');

    console.log('🌐 生效后访问:');
    console.log(`   http://${selectedDomain.domainName}`);
    console.log(`   http://www.${selectedDomain.domainName}`);
    console.log('');

    // 保存配置
    const configPath = path.join(process.cwd(), '.dns-config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        domainName: selectedDomain.domainName,
        albDns: ALB_DNS,
        recordType: 'CNAME',
        configuredAt: new Date().toISOString(),
        records: {
          root: addRoot.toLowerCase() === 'y',
          www: addWww.toLowerCase() === 'y',
        },
      }, null, 2)
    );
    console.log('✅ 配置已保存到 .dns-config.json');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ 配置失败:', error.message);
    console.error('');
    process.exit(1);
  }
}

main().catch(console.error);
