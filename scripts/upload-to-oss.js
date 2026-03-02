#!/usr/bin/env node
/**
 * 上传前端文件到 OSS
 */

import OSS from 'ali-oss';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const client = new OSS({
  region: 'oss-cn-hangzhou',
  accessKeyId: process.env.ACCESS_KEY_ID,
  accessKeySecret: process.env.ACCESS_KEY_SECRET,
  bucket: 'picshare-photos',
});

async function uploadDir(localDir, ossPrefix = '') {
  const files = fs.readdirSync(localDir);
  const results = [];

  for (const file of files) {
    const localPath = path.join(localDir, file);
    const stat = fs.statSync(localPath);

    if (stat.isDirectory()) {
      const subResults = await uploadDir(localPath, path.join(ossPrefix, file));
      results.push(...subResults);
    } else {
      const ossPath = path.join(ossPrefix, file).replace(/\\/g, '/');

      try {
        console.log(`📤 上传: ${file} → ${ossPath}`);

        // 设置正确的 Content-Type
        const headers = {};
        if (file.endsWith('.html')) {
          headers['Content-Type'] = 'text/html; charset=utf-8';
        } else if (file.endsWith('.css')) {
          headers['Content-Type'] = 'text/css; charset=utf-8';
        } else if (file.endsWith('.js')) {
          headers['Content-Type'] = 'application/javascript; charset=utf-8';
        } else if (file.endsWith('.json')) {
          headers['Content-Type'] = 'application/json; charset=utf-8';
        } else if (file.endsWith('.svg')) {
          headers['Content-Type'] = 'image/svg+xml';
        }

        const result = await client.put(ossPath, localPath, {
          headers: headers,
        });

        results.push({ file: ossPath, url: result.url });
        console.log(`   ✅ ${result.url}`);
      } catch (error) {
        console.error(`   ❌ 失败: ${error.message}`);
      }
    }
  }

  return results;
}

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║       上传前端到 OSS                 ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('Bucket: picshare-photos');
  console.log('Region: oss-cn-hangzhou');
  console.log('');

  const distDir = path.join(__dirname, 'frontend', 'dist');

  if (!fs.existsSync(distDir)) {
    console.error('❌ 未找到 dist 目录，请先构建前端');
    process.exit(1);
  }

  try {
    console.log('📦 开始上传...');
    console.log('');

    const results = await uploadDir(distDir, 'frontend');

    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║           ✅ 上传完成！              ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
    console.log(`📊 共上传 ${results.length} 个文件`);
    console.log('');
    console.log('🌐 访问地址:');
    console.log('   http://www.picshare.com.cn');
    console.log('');
    console.log('💡 注意:');
    console.log('   • CDN 可能需要 5-10 分钟刷新缓存');
    console.log('   • 如需立即生效，请在 CDN 控制台刷新缓存');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ 上传失败:', error.message);
    console.error('');
    process.exit(1);
  }
}

main().catch(console.error);
