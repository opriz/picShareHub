#!/usr/bin/env node
/**
 * 查询阿里云 CDN 配置
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

function signRequest(method, path, params, secret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const stringToSign = `${method}&${encodeURIComponent(path)}&${encodeURIComponent(sortedParams)}`;
  return crypto.createHmac('sha1', secret + '&').update(stringToSign).digest('base64');
}

function apiRequest(hostname, action, params, version = '2018-05-10') {
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

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║       查询阿里云 CDN 配置            ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  try {
    // 查询 CDN 域名列表
    console.log('🔍 查询 CDN 域名...');
    const result = await apiRequest(
      'cdn.aliyuncs.com',
      'DescribeUserDomains',
      {
        PageSize: 50,
      }
    );

    if (result.Domains && result.Domains.PageData) {
      const domains = Array.isArray(result.Domains.PageData)
        ? result.Domains.PageData
        : [result.Domains.PageData];

      if (domains.length > 0) {
        console.log(`✅ 找到 ${domains.length} 个 CDN 域名:`);
        console.log('');

        for (const domain of domains) {
          console.log(`📦 域名: ${domain.DomainName}`);
          console.log(`   CNAME: ${domain.Cname}`);
          console.log(`   状态: ${domain.DomainStatus}`);
          console.log(`   类型: ${domain.CdnType}`);

          // 查询详细配置
          try {
            const detail = await apiRequest(
              'cdn.aliyuncs.com',
              'DescribeCdnDomainDetail',
              {
                DomainName: domain.DomainName,
              }
            );

            if (detail.GetDomainDetailModel) {
              const model = detail.GetDomainDetailModel;
              console.log(`   源站类型: ${model.SourceType || 'N/A'}`);

              if (model.Sources && model.Sources.Source) {
                const sources = Array.isArray(model.Sources.Source)
                  ? model.Sources.Source
                  : [model.Sources.Source];
                console.log(`   源站地址:`);
                sources.forEach(s => {
                  console.log(`     - ${s.Content} (${s.Type})`);
                });
              }
            }
          } catch (e) {
            console.log(`   详情: 查询失败`);
          }

          console.log('');
        }

        // 输出建议
        console.log('╔══════════════════════════════════════╗');
        console.log('║           配置建议                   ║');
        console.log('╚══════════════════════════════════════╝');
        console.log('');

        const picShareDomain = domains.find(d =>
          d.DomainName.includes('picshare') ||
          d.DomainName.includes('www')
        );

        if (picShareDomain) {
          console.log('✅ 发现 PicShare 相关 CDN 域名');
          console.log('');
          console.log('推荐架构:');
          console.log('');
          console.log('方案 A: 前后端分离（推荐）');
          console.log('  • 前端: ' + picShareDomain.DomainName + ' → CDN');
          console.log('  • API:  api.picshare.com.cn → ALB');
          console.log('');
          console.log('方案 B: 同域名路径分离');
          console.log('  • www.picshare.com.cn → CDN (回源到 ALB)');
          console.log('  • CDN 配置路径规则:');
          console.log('    - /api/* → 回源到 ALB (不缓存)');
          console.log('    - /assets/*, *.js, *.css → CDN 缓存');
          console.log('');
        } else {
          console.log('💡 建议创建 CDN 域名:');
          console.log('  1. 前端 CDN: www.picshare.com.cn');
          console.log('  2. API 域名: api.picshare.com.cn → ALB');
          console.log('');
        }

      } else {
        console.log('⚠️  未找到 CDN 域名');
        console.log('');
        console.log('💡 建议配置:');
        console.log('  1. 创建 CDN 域名: www.picshare.com.cn');
        console.log('  2. 源站类型: OSS 或 IP');
        console.log('  3. 源站地址: ALB DNS 或 OSS Bucket');
        console.log('  4. 配置缓存规则');
        console.log('');
      }

    } else {
      console.log('⚠️  未找到 CDN 域名');
      console.log('');
    }

    // 查询 OSS Bucket
    console.log('🔍 查询 OSS Bucket...');
    const ossResult = await apiRequest(
      'oss-cn-hangzhou.aliyuncs.com',
      'ListBuckets',
      {},
      '2013-10-15'
    );

    if (ossResult.Buckets && ossResult.Buckets.Bucket) {
      const buckets = Array.isArray(ossResult.Buckets.Bucket)
        ? ossResult.Buckets.Bucket
        : [ossResult.Buckets.Bucket];

      console.log(`✅ 找到 ${buckets.length} 个 OSS Bucket:`);
      buckets.forEach(b => {
        console.log(`  • ${b.Name} (${b.Location})`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    console.error('');
  }
}

main().catch(console.error);
